/**
 * UCDP Ingestion Service
 *
 * 1. On startup: bulk loads ALL GED events (400k+) if no UCDP events exist
 * 2. Otherwise: fetches only Candidate Events (last 60 days of monthly updates)
 * 3. Normalizes via normalization.js and batch-inserts into events table
 * 4. Populates conflicts table from UCDP PRIO conflict list
 * 5. Sets origin_lat/origin_lng to country centroid for strike arc rendering
 */

import axios  from 'axios'
import dotenv from 'dotenv'
import pool   from '../db.js'
import { normalizeUcdpEvent } from './normalization.js'
import { onUcdpIngest } from '../cache.js'

dotenv.config({ path: '../.env' })

const BASE     = 'https://ucdpapi.pcr.uu.se/api'
const VERSION  = '25.1'
const PAGESIZE = 1000
const BATCH    = 200    // rows per DB transaction

// UCDP requires an API token — register free at https://ucdpapi.pcr.uu.se/
const API_TOKEN = process.env.UCDP_API_TOKEN || ''
const UCDP_HEADERS = {
  'User-Agent': 'ThreatWatch/1.0 (conflict monitoring research)',
  ...(API_TOKEN ? { 'x-ucdp-access-token': API_TOKEN } : {}),
}

// ── Country centroid lookup — used as fallback origin for strike arcs ─────────
// lat, lng of approximate geographic centroid
const COUNTRY_CENTROIDS = {
  'Afghanistan':         [33.93,  67.71],
  'Albania':             [41.15,  20.17],
  'Algeria':             [28.03,   1.66],
  'Angola':              [-11.20, 17.87],
  'Armenia':             [40.07,  45.04],
  'Azerbaijan':          [40.14,  47.58],
  'Bangladesh':          [23.68,  90.36],
  'Bosnia':              [43.92,  17.68],
  'Burkina Faso':        [12.37,  -1.54],
  'Burundi':             [-3.37,  29.92],
  'Cambodia':            [12.57, 104.99],
  'Cameroon':            [3.85,   11.50],
  'CAR':                 [6.61,   20.94],
  'Chad':                [15.45,  18.73],
  'Colombia':            [4.57,  -74.30],
  'Congo':               [-0.23,  15.83],
  'DR Congo':            [-4.04,  21.76],
  'Egypt':               [26.82,  30.80],
  'El Salvador':         [13.79, -88.90],
  'Eritrea':             [15.18,  39.78],
  'Ethiopia':            [9.15,   40.49],
  'Georgia':             [42.31,  43.36],
  'Guatemala':           [15.78, -90.23],
  'Guinea':              [11.00, -10.94],
  'Guinea-Bissau':       [11.80, -15.18],
  'Haiti':               [18.97, -72.29],
  'India':               [20.59,  78.96],
  'Indonesia':           [-0.79, 113.92],
  'Iran':                [32.43,  53.69],
  'Iraq':                [33.22,  43.68],
  'Israel':              [31.05,  34.85],
  'Ivory Coast':         [7.54,   -5.55],
  'Kenya':               [-0.02,  37.91],
  'Kosovo':              [42.60,  20.90],
  'Kyrgyzstan':          [41.20,  74.77],
  'Lebanon':             [33.85,  35.86],
  'Liberia':             [6.43,   -9.43],
  'Libya':               [26.34,  17.23],
  'Mali':                [17.57,  -3.99],
  'Mauritania':          [21.01, -10.94],
  'Mexico':              [23.63, -102.55],
  'Morocco':             [31.79,  -7.09],
  'Mozambique':          [-18.67,  35.53],
  'Myanmar':             [21.92,  95.96],
  'Nepal':               [28.39,  84.12],
  'Niger':               [17.61,   8.08],
  'Nigeria':             [9.08,    8.68],
  'North Korea':         [40.34, 127.51],
  'Pakistan':            [30.38,  69.35],
  'Palestine':           [31.95,  35.23],
  'Papua New Guinea':    [-6.31, 143.96],
  'Peru':                [-9.19, -75.02],
  'Philippines':         [12.88, 121.77],
  'Russia':              [61.52, 105.32],
  'Rwanda':              [-1.94,  29.87],
  'Saudi Arabia':        [23.89,  45.08],
  'Senegal':             [14.50, -14.45],
  'Sierra Leone':        [8.46,  -11.78],
  'Somalia':             [5.15,   46.20],
  'South Sudan':         [6.88,   31.57],
  'Sri Lanka':           [7.87,   80.77],
  'Sudan':               [12.86,  30.22],
  'Syria':               [34.80,  38.99],
  'Tajikistan':          [38.86,  71.28],
  'Tanzania':            [-6.37,  34.89],
  'Thailand':            [15.87, 100.99],
  'Timor-Leste':         [-8.87, 125.73],
  'Togo':                [8.62,    0.82],
  'Turkey':              [38.96,  35.24],
  'Uganda':              [1.37,   32.29],
  'Ukraine':             [48.38,  31.17],
  'United States':       [37.09, -95.71],
  'Uzbekistan':          [41.38,  64.59],
  'Venezuela':           [6.42,  -66.59],
  'Vietnam':             [14.06, 108.28],
  'West Bank':           [31.95,  35.30],
  'Yemen':               [15.55,  48.52],
  'Zimbabwe':            [-19.02,  29.15],
  'Zambia':              [-13.13,  27.85],
}

function getCountryCentroid(countryName) {
  return COUNTRY_CENTROIDS[countryName] || null
}

// ── Fetch one page from a UCDP endpoint ───────────────────────────────────────
// versionOverride: use a different version string (e.g. '25.0.3' for candidate)
async function fetchPage(endpoint, page = 1, extraParams = {}, versionOverride = null) {
  const params = new URLSearchParams({ pagesize: PAGESIZE, page, ...extraParams })
  const ver = versionOverride || VERSION
  const url = `${BASE}/${endpoint}/${ver}?${params}`
  const res = await axios.get(url, { timeout: 30000, headers: UCDP_HEADERS })
  return res.data
}

// ── Retry wrapper for network errors (ECONNRESET etc.) ────────────────────────
async function fetchPageWithRetry(endpoint, page, extraParams = {}, versionOverride = null, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchPage(endpoint, page, extraParams, versionOverride)
    } catch (err) {
      const isRetryable = err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' ||
                          err.code === 'ETIMEDOUT'  || (err.response?.status >= 500)
      if (isRetryable && attempt < retries) {
        console.warn(`[ucdp] page ${page} attempt ${attempt} failed (${err.message}) — retrying in 2s`)
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      throw err
    }
  }
}

// ── Upsert a batch of normalized events ───────────────────────────────────────
async function upsertBatch(events) {
  if (!events.length) return 0
  const client = await pool.connect()
  let inserted = 0
  try {
    await client.query('BEGIN')
    for (const e of events) {
      if (!e.id || !e.date || !e.type || !e.country) continue
      await client.query(`
        INSERT INTO events (
          id, source, source_id, date, type, subtype,
          country, admin1, location, lat, lng, origin_lat, origin_lng,
          geo_precision, actor1, actor2,
          fatalities, fatalities_low, fatalities_high,
          notes, url, tone, goldstein
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,$13,
          $14,$15,$16,
          $17,$18,$19,
          $20,$21,$22,$23
        )
        ON CONFLICT (source, source_id) DO NOTHING
      `, [
        e.id, e.source, e.source_id, e.date, e.type, e.subtype,
        e.country, e.admin1, e.location,
        e.lat, e.lng, e.origin_lat, e.origin_lng,
        e.geo_precision, e.actor1, e.actor2,
        e.fatalities, e.fatalities_low, e.fatalities_high,
        e.notes, e.url, e.tone, e.goldstein,
      ])
      inserted++
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  return inserted
}

// ── Add country centroid as origin for strike arc rendering ───────────────────
function withOrigin(normalized, rawCountry) {
  if (normalized.origin_lat && normalized.origin_lng) return normalized
  const centroid = getCountryCentroid(rawCountry)
  if (centroid) {
    return { ...normalized, origin_lat: centroid[0], origin_lng: centroid[1] }
  }
  return normalized
}

// ── Check how many UCDP events we already have ────────────────────────────────
async function countUcdpEvents() {
  const r = await pool.query(`SELECT COUNT(*) FROM events WHERE source = 'UCDP'`)
  return parseInt(r.rows[0].count)
}

// ── Bulk load ALL GED events (called once when table is empty) ────────────────
export async function bulkLoadGED() {
  console.log('[ucdp] starting GED bulk load — fetching page 1 to get total...')
  const first = await fetchPageWithRetry('GEDEvents', 1)
  const totalPages = first.TotalPages || 1
  const totalCount = first.TotalCount || 0
  console.log(`[ucdp] GED bulk load: ${totalCount} events across ${totalPages} pages`)

  let totalInserted = 0
  const firstBatch = (first.Result || []).map(raw => withOrigin(normalizeUcdpEvent(raw), raw.country))
  totalInserted += await upsertBatch(firstBatch)

  for (let page = 2; page <= totalPages; page++) {
    try {
      const data   = await fetchPageWithRetry('GEDEvents', page)
      const events = (data.Result || []).map(raw => withOrigin(normalizeUcdpEvent(raw), raw.country))
      totalInserted += await upsertBatch(events)
      if (page % 50 === 0 || page === totalPages) {
        console.log(`[ucdp] GED bulk load: page ${page}/${totalPages} — ${totalInserted} inserted so far`)
      }
      if (page % 100 === 0) await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      console.warn(`[ucdp] GED page ${page} failed after retries: ${err.message} — skipping`)
    }
  }

  console.log(`[ucdp] GED bulk load complete: ${totalInserted} events inserted`)
  return totalInserted
}

// ── Fetch recent GED events (called on subsequent runs) ───────────────────────
// Anchors to the last event stored in DB — catches up from there, not from NOW()-60
async function loadRecentEvents() {
  const { rows: [{ lastDate }] } = await pool.query(
    `SELECT MAX(date) AS "lastDate" FROM events WHERE source = 'UCDP'`
  )
  // Start 1 day before our last event to catch any missed events on that day
  const anchor = lastDate ? new Date(lastDate) : new Date('2023-01-01')
  anchor.setDate(anchor.getDate() - 1)
  const StartDate = anchor.toISOString().split('T')[0]

  console.log(`[ucdp] fetching GEDEvents since ${StartDate} (last stored: ${lastDate})...`)
  const first = await fetchPage('GEDEvents', 1, { StartDate })
  const totalPages = first.TotalPages || 1
  let inserted = 0

  const pages = [first]
  for (let page = 2; page <= totalPages; page++) {
    try {
      pages.push(await fetchPage('GEDEvents', page, { StartDate }))
    } catch (err) {
      console.warn(`[ucdp] recent events page ${page} failed: ${err.message}`)
    }
  }

  for (const data of pages) {
    const events = (data.Result || []).map(raw => withOrigin(normalizeUcdpEvent(raw), raw.country))
    inserted += await upsertBatch(events)
  }

  console.log(`[ucdp] recent events: ${inserted} new`)
  return inserted
}

// ── Fetch UCDP Candidate Events (monthly releases, covers 2025–present) ──────
// Version scheme: 25.0.1 = Jan 2025, 25.0.12 = Dec 2025, 26.0.1 = Jan 2026, etc.
// Uses same gedevents endpoint, same field format — inserted as UCDP_CANDIDATE.
export async function fetchCandidateEvents() {
  const candidateVersions = []
  // Jan–Dec 2025
  for (let m = 1; m <= 12; m++) candidateVersions.push(`25.0.${m}`)
  // Jan–Feb 2026 (latest available as of Apr 2026)
  candidateVersions.push('26.0.1', '26.0.2')

  let totalInserted = 0

  for (const ver of candidateVersions) {
    try {
      const first = await fetchPage('gedevents', 1, {}, ver)
      // 404 / bad response for unreleased months
      if (!first || !first.TotalCount) continue

      const totalPages = first.TotalPages || 1
      const totalCount = first.TotalCount || 0
      console.log(`[ucdp-candidate] ${ver}: ${totalCount} events across ${totalPages} pages`)

      const normalize = raw => {
        const base = normalizeUcdpEvent(raw)
        return {
          ...base,
          id:     `UCDP_CAND_${raw.id}`,
          source: 'UCDP_CANDIDATE',
        }
      }

      const firstBatch = (first.Result || []).map(raw => withOrigin(normalize(raw), raw.country))
      totalInserted += await upsertBatch(firstBatch)

      for (let page = 2; page <= totalPages; page++) {
        try {
          const data   = await fetchPageWithRetry('gedevents', page, {}, ver)
          const events = (data.Result || []).map(raw => withOrigin(normalize(raw), raw.country))
          totalInserted += await upsertBatch(events)
          if (page % 10 === 0 || page === totalPages) {
            console.log(`[ucdp-candidate] ${ver}: page ${page}/${totalPages}`)
          }
        } catch (err) {
          console.warn(`[ucdp-candidate] ${ver} page ${page} failed: ${err.message} — skipping`)
        }
      }
    } catch (err) {
      // 404 = version not yet released — skip silently
      if (err.response?.status === 404 || err.response?.status === 400) continue
      console.warn(`[ucdp-candidate] ${ver} failed: ${err.message}`)
    }
  }

  console.log(`[ucdp-candidate] total inserted: ${totalInserted}`)
  return totalInserted
}

// ── Find the latest available candidate version ───────────────────────────────
// Returns e.g. '26.0.2' — used by the daily cron to check for new releases
export async function getLatestCandidateVersion() {
  const now   = new Date()
  const year  = now.getFullYear() - 2000  // 26 for 2026
  const month = now.getMonth() + 1        // 1-12

  // Try current month, then walk back until we find a released version
  for (let m = month; m >= 1; m--) {
    const ver = `${year}.0.${m}`
    try {
      const res = await fetchPage('gedevents', 1, { pagesize: 1 }, ver)
      if (res?.TotalCount > 0) return ver
    } catch (err) {
      if (err.response?.status !== 404 && err.response?.status !== 400) {
        console.warn(`[ucdp-candidate] version probe ${ver} failed: ${err.message}`)
      }
    }
  }
  // Fall back to previous year December
  return `${year - 1}.0.12`
}

// ── Sync UCDP PRIO conflicts into the conflicts table ─────────────────────────
async function syncConflicts() {
  console.log('[ucdp] syncing conflicts...')
  const first = await fetchPage('UcdpPrioConflict', 1)
  const totalPages = first.TotalPages || 1
  let synced = 0

  const allPages = [first.Result || []]
  for (let page = 2; page <= totalPages; page++) {
    try {
      const data = await fetchPage('UcdpPrioConflict', page)
      allPages.push(data.Result || [])
    } catch {}
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const rows of allPages) {
      for (const c of rows) {
        if (!c.conflict_id && !c.id) continue
        const id      = `ucdp_${c.conflict_id || c.id}`
        const title   = c.conflict_name || c.name || 'Unknown conflict'
        const country = c.location || c.territory_name || 'Unknown'

        await client.query(`
          INSERT INTO conflicts (id, title, status, countries, actors, context)
          VALUES ($1, $2, 'confirmed', $3, $4, $5)
          ON CONFLICT (id) DO UPDATE
            SET title = EXCLUDED.title,
                updated_at = NOW()
        `, [
          id,
          title,
          [country],
          [c.side_a, c.side_b].filter(Boolean),
          c.territory_name || null,
        ])
        synced++
      }
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.warn('[ucdp] conflict sync error:', err.message)
  } finally {
    client.release()
  }

  console.log(`[ucdp] conflict sync: ${synced} conflicts`)
  return synced
}

// ── Main export: run the full UCDP ingest cycle ───────────────────────────────
export async function ingestUCDP() {
  if (!API_TOKEN) {
    console.warn('[ucdp] UCDP_API_TOKEN not set — skipping ingest.')
    console.warn('[ucdp] Register free at https://ucdpapi.pcr.uu.se/ and add to .env')
    return { eventsInserted: 0, conflictsInserted: 0 }
  }

  const existing = await countUcdpEvents()

  let eventsInserted = 0
  if (existing === 0) {
    eventsInserted = await bulkLoadGED()
  } else {
    eventsInserted = await loadRecentEvents()
  }

  // Always fetch/refresh candidate events (monthly releases for 2025–present)
  eventsInserted += await fetchCandidateEvents()

  const conflictsInserted = await syncConflicts()

  // Flush stale cache + refresh materialized views (rule 12)
  if (eventsInserted > 0) {
    onUcdpIngest(pool).catch(err =>
      console.warn('[ucdp] cache invalidation failed:', err.message)
    )
  }

  console.log(`[ucdp] ingest complete: ${eventsInserted} events, ${conflictsInserted} conflicts`)
  return { eventsInserted, conflictsInserted }
}
