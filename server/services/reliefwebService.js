/**
 * ReliefWeb Humanitarian Service
 *
 * Fetches armed-conflict humanitarian reports + current disasters from the
 * ReliefWeb API v2 and upserts them into the `humanitarian` table.
 *
 * API docs: https://apidoc.reliefweb.int
 * Uses POST requests per ReliefWeb recommendation for complex queries.
 *
 * TODO: Replace 'apidoc' with approved appname from .env (RELIEFWEB_APP)
 *       when ReliefWeb approves registration at https://apidoc.reliefweb.int/parameters#appname
 */

import pool from '../db.js'

// NOTE: ReliefWeb now requires an approved appname — register at:
// https://apidoc.reliefweb.int/parameters#appname
// Set RELIEFWEB_APP=<your-approved-name> in .env to enable live fetching.
// Until then, the humanitarian table is seeded with current crisis figures.
const APP_NAME = process.env.RELIEFWEB_APP || 'apidoc'
const BASE     = 'https://api.reliefweb.int/v2'
const TIMEOUT  = 30000

// ── POST helper ───────────────────────────────────────────────────────────────
async function rwPost(endpoint, body) {
  const url = `${BASE}/${endpoint}?appname=${APP_NAME}`
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 403) {
      throw new Error(`ReliefWeb appname "${APP_NAME}" not approved. Register at https://apidoc.reliefweb.int/parameters#appname and set RELIEFWEB_APP in .env`)
    }
    throw new Error(`ReliefWeb ${endpoint} → HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ── Strip HTML tags and collapse whitespace ───────────────────────────────────
function stripHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g,    ' ')
    .trim()
}

// ── Extract affected/displaced numbers from plain text ────────────────────────
function extractNumbers(text = '') {
  let affected  = null
  let displaced = null

  const aff = text.match(/(\d[\d,.]+)\s*(?:million\s*)?(?:people|persons?|individuals?)\s*(?:affected|impacted)/i)
  if (aff) {
    const raw = parseFloat(aff[1].replace(/,/g, ''))
    affected = text.slice(0, aff.index + aff[0].length).match(/million/i) ? Math.round(raw * 1e6) : raw
  }

  const dis = text.match(/(\d[\d,.]+)\s*(?:million\s*)?(?:people|persons?|individuals?|IDPs?)\s*(?:displaced|fled|uprooted)/i)
  if (dis) {
    const raw = parseFloat(dis[1].replace(/,/g, ''))
    displaced = text.slice(0, dis.index + dis[0].length).match(/million/i) ? Math.round(raw * 1e6) : raw
  }

  return { affected, displaced }
}

// ── Fetch conflict reports ────────────────────────────────────────────────────
async function fetchConflictReports(limit = 1000) {
  const data = await rwPost('reports', {
    filter: {
      operator:   'AND',
      conditions: [
        { field: 'theme',        value: 'Armed Conflict' },
        { field: 'date.created', value: { from: '2024-01-01T00:00:00+00:00' } },
      ],
    },
    fields: {
      include: ['title', 'body', 'url', 'source.name', 'country.name', 'date.created', 'theme.name'],
    },
    sort:  ['date.created:desc'],
    limit,
  })
  return data.data || []
}

// ── Fetch current disasters ───────────────────────────────────────────────────
async function fetchDisasters(limit = 100) {
  const data = await rwPost('disasters', {
    filter: { field: 'status', value: 'current' },
    fields: { include: ['name', 'country.name', 'type.name', 'date.created', 'url', 'status'] },
    limit,
  })
  return data.data || []
}

// ── Upsert a report row ───────────────────────────────────────────────────────
async function upsertReport(client, item) {
  const f  = item.fields || {}
  const id = item.id ? parseInt(item.id) : null
  if (!id) return

  const title       = f.title                     || null
  const country     = (f.country || [])[0]?.name  || null
  const sourceOrg   = (f.source  || [])[0]?.name  || null
  const rawBody     = f.body                       || ''
  const plain       = stripHtml(rawBody)
  const summary     = plain.slice(0, 500)          || null
  const url         = f.url                        || null
  const publishedAt = f.date?.created ? new Date(f.date.created) : null

  const { affected, displaced } = extractNumbers(plain)

  await client.query(`
    INSERT INTO humanitarian
      (reliefweb_id, title, country, disaster_type, status, source_org,
       summary, people_affected, people_displaced, url, published_at)
    VALUES ($1,$2,$3,'Armed Conflict','ongoing',$4,$5,$6,$7,$8,$9)
    ON CONFLICT (reliefweb_id) DO UPDATE
      SET title            = EXCLUDED.title,
          summary          = EXCLUDED.summary,
          country          = EXCLUDED.country,
          source_org       = EXCLUDED.source_org,
          people_affected  = COALESCE(EXCLUDED.people_affected,  humanitarian.people_affected),
          people_displaced = COALESCE(EXCLUDED.people_displaced, humanitarian.people_displaced),
          published_at     = EXCLUDED.published_at
  `, [id, title, country, sourceOrg, summary, affected, displaced, url, publishedAt])
}

// ── Upsert a disaster row ─────────────────────────────────────────────────────
async function upsertDisaster(client, item) {
  // Disasters use negative IDs to avoid colliding with report IDs
  const f  = item.fields || {}
  const id = item.id ? -(parseInt(item.id)) : null
  if (!id) return

  const title       = f.name                       || null
  const country     = (f.country || [])[0]?.name   || null
  const type        = (f.type    || [])[0]?.name   || 'Disaster'
  const url         = f.url                        || null
  const publishedAt = f.date?.created ? new Date(f.date.created) : null

  await client.query(`
    INSERT INTO humanitarian
      (reliefweb_id, title, country, disaster_type, status, source_org,
       summary, url, published_at)
    VALUES ($1,$2,$3,$4,$5,'ReliefWeb',null,$6,$7)
    ON CONFLICT (reliefweb_id) DO UPDATE
      SET title        = EXCLUDED.title,
          country      = EXCLUDED.country,
          disaster_type= EXCLUDED.disaster_type,
          status       = EXCLUDED.status,
          published_at = EXCLUDED.published_at
  `, [id, title, country, type, f.status || 'current', url, publishedAt])
}

// ── Main export — called by poller and directly ───────────────────────────────
export async function ingestReliefWeb() {
  console.log(`[reliefweb] fetching with appname="${APP_NAME}"...`)

  let reportCount   = 0
  let disasterCount = 0

  // ── Reports ──────────────────────────────────────────────────────────────
  try {
    const reports = await fetchConflictReports(1000)
    console.log(`[reliefweb] got ${reports.length} conflict reports`)

    if (reports.length) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        for (const item of reports) {
          if (!item.id || !item.fields?.title) continue
          await upsertReport(client, item)
          reportCount++
        }
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }
  } catch (err) {
    console.error('[reliefweb] reports fetch failed:', err.message)
  }

  // ── Disasters ─────────────────────────────────────────────────────────────
  try {
    const disasters = await fetchDisasters(100)
    console.log(`[reliefweb] got ${disasters.length} current disasters`)

    if (disasters.length) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        for (const item of disasters) {
          if (!item.id) continue
          await upsertDisaster(client, item)
          disasterCount++
        }
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }
  } catch (err) {
    console.error('[reliefweb] disasters fetch failed:', err.message)
  }

  const total = reportCount + disasterCount
  console.log(`[reliefweb] done — ${reportCount} reports + ${disasterCount} disasters = ${total} rows upserted`)
  return total
}
