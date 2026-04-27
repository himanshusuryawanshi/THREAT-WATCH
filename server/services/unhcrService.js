/**
 * UNHCR Refugee Statistics Service
 *
 * Fetches bilateral displacement data from the UNHCR Population API v1.
 * The API only returns bilateral data when both coo + coa are specified,
 * so we iterate over the top origin + asylum country pairs systematically.
 *
 * Data schema note: the UNHCR API returns:
 *   coo_iso / coa_iso — ISO3 codes
 *   coo_name / coa_name — country display names
 *   refugees, asylum_seekers, idps, stateless
 *
 * Insert into displacement table with ON CONFLICT DO UPDATE.
 * Call onUnhcrIngest() to flush cache after ingestion.
 */

import pool from '../db.js'
import { onUnhcrIngest } from '../cache.js'

const UNHCR_BASE = 'https://api.unhcr.org/population/v1/population'
const TIMEOUT    = 20000
const YEARS      = [2024, 2023]  // fetch both years

// Top refugee origin countries — accounts for ~90% of global displacement
const TOP_ORIGIN_ISOS = [
  'SYR', // Syria          — 5.9M refugees
  'UKR', // Ukraine        — 5.1M refugees
  'AFG', // Afghanistan    — 5.8M refugees
  'VEN', // Venezuela      — 7.7M abroad
  'SSD', // South Sudan    — 2.3M refugees
  'MMR', // Myanmar        — 1.3M refugees
  'COD', // DRC            — 1.1M refugees
  'SDN', // Sudan          — 1.1M refugees
  'SOM', // Somalia        — 844K refugees
  'ETH', // Ethiopia       — 157K refugees (also hosts many)
  'NGA', // Nigeria        — 97K refugees
  'ERI', // Eritrea        — 556K refugees
  'IRQ', // Iraq           — 291K refugees
  'CAF', // Central African Republic — 788K refugees
  'MLI', // Mali           — 231K refugees
  'YEM', // Yemen          — 82K refugees
  'PAK', // Pakistan       — 77K refugees
  'COL', // Colombia       — 140K refugees (+ many IDPs)
  'HTI', // Haiti          — 247K refugees
  'BDI', // Burundi        — 312K refugees
]

// Top asylum/hosting countries — where most refugees go
const TOP_ASYLUM_ISOS = [
  'TUR', // Turkey         — hosts 3.2M (Syria)
  'COL', // Colombia       — hosts 2.9M (Venezuela)
  'DEU', // Germany        — hosts 2.5M
  'PAK', // Pakistan       — hosts 1.7M (Afghanistan)
  'UGA', // Uganda         — hosts 1.6M (South Sudan, DRC)
  'IRN', // Iran           — hosts 3.8M
  'RUS', // Russia         — hosts 1.2M (Ukraine)
  'ETH', // Ethiopia       — hosts 1.0M
  'POL', // Poland         — hosts 980K (Ukraine)
  'USA', // United States  — hosts 1.6M
  'KEN', // Kenya          — hosts 590K
  'LBN', // Lebanon        — hosts 790K (Syria)
  'SDN', // Sudan          — hosts 1.1M (South Sudan, CAF, Ethiopia)
  'CHN', // China          — hosts 300K
  'BRA', // Brazil         — hosts 527K (Venezuela)
  'JOR', // Jordan         — hosts 740K (Syria)
  'FRA', // France         — hosts 620K
  'GBR', // UK             — hosts 220K
  'SWE', // Sweden         — hosts 300K
  'CAN', // Canada         — hosts 290K
  'EGY', // Egypt          — hosts 402K (Sudan, Syria)
  'BGD', // Bangladesh     — hosts 965K (Myanmar/Rohingya)
  'TCD', // Chad           — hosts 1.1M (Sudan, CAF, South Sudan)
  'KAZ', // Kazakhstan     — hosts 147K
  'ECU', // Ecuador        — hosts 498K (Venezuela)
  'MYS', // Malaysia       — hosts 178K (Myanmar)
  'IND', // India          — hosts 222K
  'THA', // Thailand       — hosts 90K (Myanmar)
  'DNK', // Denmark        — hosts 118K
  'AUT', // Austria        — hosts 151K
]

// ── Single API call ───────────────────────────────────────────────────────────
async function fetchPair(year, cooIso, coaIso) {
  const url = `${UNHCR_BASE}/?year=${year}&coo=${cooIso}&coa=${coaIso}&limit=1`
  const res  = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) throw new Error(`UNHCR API ${res.status} for ${cooIso}→${coaIso}`)
  const data = await res.json()
  // Find the bilateral row (coa_id != '-')
  return (data.items || []).find(i => i.coa_id !== '-' && i.coo_id !== '-') || null
}

// ── Fetch global aggregate ────────────────────────────────────────────────────
async function fetchGlobalTotals(year) {
  const url = `${UNHCR_BASE}/?year=${year}&limit=1`
  const res  = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) throw new Error(`UNHCR global ${res.status}`)
  const data = await res.json()
  // Global row has coo_id == '-'
  return (data.items || []).find(i => i.coo_id === '-') || null
}

// ── Fetch per-origin totals (no coa filter) ───────────────────────────────────
async function fetchOriginTotal(year, cooIso) {
  const url = `${UNHCR_BASE}/?year=${year}&coo=${cooIso}&limit=1`
  const res  = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) return null
  const data = await res.json()
  // Aggregate row (no specific COA): coa_id == '-'
  return (data.items || []).find(i => i.coa_id === '-') || null
}

// ── Batch fetch with controlled concurrency ───────────────────────────────────
async function batchFetch(tasks, concurrency = 8) {
  const results = []
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(t => t()))
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value)
    }
    // Small pause to be a polite API citizen
    if (i + concurrency < tasks.length) await new Promise(r => setTimeout(r, 200))
  }
  return results
}

// ── Upsert a displacement row ─────────────────────────────────────────────────
async function upsertRow(client, row) {
  await client.query(`
    INSERT INTO displacement
      (year, country_origin, country_asylum, iso_origin, iso_asylum,
       refugees, asylum_seekers, idps, stateless)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (year, country_origin, country_asylum) DO UPDATE
      SET refugees        = EXCLUDED.refugees,
          asylum_seekers  = EXCLUDED.asylum_seekers,
          idps            = EXCLUDED.idps,
          stateless       = EXCLUDED.stateless,
          iso_origin      = EXCLUDED.iso_origin,
          iso_asylum      = EXCLUDED.iso_asylum,
          updated_at      = NOW()
  `, [
    row.year,
    row.coo_name,
    row.coa_name,
    row.coo_iso || row.coo,
    row.coa_iso || row.coa,
    parseInt(row.refugees)      || 0,
    parseInt(row.asylum_seekers)|| 0,
    parseInt(row.idps)          || 0,
    parseInt(row.stateless)     || 0,
  ])
}

// ── Also store per-origin aggregate rows (no COA) ─────────────────────────────
async function upsertOriginTotal(client, item) {
  if (!item || item.coa_id !== '-') return
  // Store as origin → 'GLOBAL' aggregate marker
  await client.query(`
    INSERT INTO displacement
      (year, country_origin, country_asylum, iso_origin, iso_asylum,
       refugees, asylum_seekers, idps, stateless)
    VALUES ($1, $2, '__TOTAL__', $3, '__TOTAL__', $4, $5, $6, $7)
    ON CONFLICT (year, country_origin, country_asylum) DO UPDATE
      SET refugees        = EXCLUDED.refugees,
          asylum_seekers  = EXCLUDED.asylum_seekers,
          idps            = EXCLUDED.idps,
          stateless       = EXCLUDED.stateless,
          updated_at      = NOW()
  `, [
    item.year,
    item.coo_name || item.coo,
    item.coo_iso  || item.coo,
    parseInt(item.refugees)      || 0,
    parseInt(item.asylum_seekers)|| 0,
    parseInt(item.idps)          || 0,
    parseInt(item.stateless)     || 0,
  ])
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function ingestUnhcr() {
  console.log('[unhcr] Starting UNHCR displacement data ingestion...')
  let totalRows = 0

  const client = await pool.connect()
  try {
    for (const year of YEARS) {
      console.log(`[unhcr] Processing year ${year}...`)

      // ── 1. Global aggregate ──────────────────────────────────────────────
      try {
        const global = await fetchGlobalTotals(year)
        if (global) {
          console.log(`[unhcr] ${year} global: ${parseInt(global.refugees).toLocaleString()} refugees, ${parseInt(global.idps).toLocaleString()} IDPs`)
          // Store global as special row
          await client.query(`
            INSERT INTO displacement
              (year, country_origin, country_asylum, iso_origin, iso_asylum,
               refugees, asylum_seekers, idps, stateless)
            VALUES ($1, '__GLOBAL__', '__GLOBAL__', '__GLOBAL__', '__GLOBAL__', $2, $3, $4, $5)
            ON CONFLICT (year, country_origin, country_asylum) DO UPDATE
              SET refugees = EXCLUDED.refugees, asylum_seekers = EXCLUDED.asylum_seekers,
                  idps = EXCLUDED.idps, stateless = EXCLUDED.stateless, updated_at = NOW()
          `, [year,
              parseInt(global.refugees)      || 0,
              parseInt(global.asylum_seekers)|| 0,
              parseInt(global.idps)          || 0,
              parseInt(global.stateless)     || 0])
        }
      } catch (err) {
        console.warn(`[unhcr] Global totals failed: ${err.message}`)
      }

      // ── 2. Per-origin totals ─────────────────────────────────────────────
      const originTasks = TOP_ORIGIN_ISOS.map(iso => () => fetchOriginTotal(year, iso))
      const originTotals = await batchFetch(originTasks, 6)
      console.log(`[unhcr] ${year}: got ${originTotals.length} origin totals`)

      await client.query('BEGIN')
      try {
        for (const item of originTotals) await upsertOriginTotal(client, item)
        await client.query('COMMIT')
        totalRows += originTotals.length
      } catch (err) {
        await client.query('ROLLBACK')
        console.error('[unhcr] Origin upsert failed:', err.message)
      }

      // ── 3. Bilateral flows ───────────────────────────────────────────────
      // Build all pairs: top origins × top asylums
      const pairs = []
      for (const coo of TOP_ORIGIN_ISOS) {
        for (const coa of TOP_ASYLUM_ISOS) {
          if (coo !== coa) pairs.push({ coo, coa })
        }
      }

      console.log(`[unhcr] ${year}: fetching ${pairs.length} bilateral flows...`)
      const bilateralTasks = pairs.map(({ coo, coa }) => () => fetchPair(year, coo, coa))
      const bilateralRows  = await batchFetch(bilateralTasks, 8)

      // Filter out zero-refugee rows
      const nonZero = bilateralRows.filter(r => parseInt(r.refugees) > 0 || parseInt(r.asylum_seekers) > 0)
      console.log(`[unhcr] ${year}: ${nonZero.length} non-zero bilateral flows`)

      await client.query('BEGIN')
      try {
        for (const row of nonZero) {
          row.year = year
          await upsertRow(client, row)
        }
        await client.query('COMMIT')
        totalRows += nonZero.length
      } catch (err) {
        await client.query('ROLLBACK')
        console.error('[unhcr] Bilateral upsert failed:', err.message)
      }
    }

    console.log(`[unhcr] Done — ${totalRows} displacement rows ingested`)
    await onUnhcrIngest()
    return totalRows

  } finally {
    client.release()
  }
}
