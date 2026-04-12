/**
 * NASA FIRMS (Fire Information for Resource Management System)
 *
 * ROLE IN THREATWATCH (Blueprint Part 3):
 *   Second independent map layer — orange pulsing dots, distinct from UCDP red dots.
 *   Satellite truth: thermal anomalies detected from space, updated within 3 hours.
 *   When a UCDP event hasn't been coded yet but FIRMS shows a massive thermal anomaly
 *   in a conflict zone, that's early signal.
 *
 * DATA SOURCE:
 *   VIIRS SNPP NRT (375m resolution, best for conflict monitoring)
 *   API: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{source}/{bbox}/{days}
 *   Register free MAP_KEY at: https://firms.modaps.eosdis.nasa.gov/api/
 *
 * STRATEGY:
 *   1. Fetch 2-day VIIRS data for every known conflict-zone bounding box
 *   2. Parse CSV → filter by confidence >= nominal
 *   3. Cross-reference each fire with nearest UCDP event via PostGIS ST_DWithin(50km)
 *      → in_conflict_zone = TRUE, nearest_event_id = closest UCDP event
 *   4. Upsert into thermal_anomalies (deduplicated by satellite+date+lat+lng)
 */

import axios    from 'axios'
import dotenv   from 'dotenv'
import { createInterface } from 'readline'
import { Readable } from 'stream'
import pool     from '../db.js'
import { onFirmsIngest } from '../cache.js'

dotenv.config({ path: '../.env' })

const MAP_KEY  = process.env.FIRMS_API_KEY || ''
const BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'
const SOURCE   = 'VIIRS_SNPP_NRT'
const DAYS     = 2    // fetch 2-day rolling window each run

// ── Conflict zone bounding boxes (W,S,E,N) ───────────────────────────────────
// Used when conflicts table has no geometry, or as primary fetch targets.
// Updated to match known active conflict zones as of 2026.
const CONFLICT_BBOXES = [
  { name: 'Ukraine',            bbox: '22,44,40,52'  },
  { name: 'Sudan',              bbox: '22,3,38,23'   },
  { name: 'Gaza/Israel',        bbox: '33,29,36,34'  },
  { name: 'Syria/Iraq',         bbox: '35,29,48,38'  },
  { name: 'Myanmar',            bbox: '92,15,102,28' },
  { name: 'DR Congo/East DRC',  bbox: '25,-5,32,5'   },
  { name: 'Yemen',              bbox: '42,12,54,20'  },
  { name: 'Somalia/Ethiopia',   bbox: '39,2,52,12'   },
  { name: 'Nigeria/Lake Chad',  bbox: '3,4,16,15'    },
  { name: 'Mali/Burkina Faso',  bbox: '-8,9,5,20'    },
  { name: 'Mozambique',         bbox: '29,-18,40,-9' },
  { name: 'Pakistan/KP',        bbox: '68,30,76,38'  },
  { name: 'South Sudan',        bbox: '24,3,36,12'   },
  { name: 'CAR',                bbox: '14,2,28,12'   },
  { name: 'Sahel (Niger/Chad)', bbox: '7,12,24,22'   },
]

// ── Parse FIRMS CSV text into row objects ─────────────────────────────────────
// VIIRS NRT columns:
//   latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,
//   satellite,instrument,confidence,version,bright_ti5,frp,daynight
function parseFirmsCSV(csvText) {
  const lines  = csvText.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const rows   = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < header.length) continue

    const row = {}
    header.forEach((h, idx) => { row[h] = cols[idx]?.trim() || '' })

    const lat  = parseFloat(row.latitude)
    const lng  = parseFloat(row.longitude)
    if (isNaN(lat) || isNaN(lng)) continue

    // Confidence: VIIRS uses 'l'(low), 'n'(nominal), 'h'(high)
    const conf = row.confidence?.toLowerCase()
    if (conf === 'l' || conf === 'low') continue   // skip low-confidence

    rows.push({
      latitude:   lat,
      longitude:  lng,
      brightness: parseFloat(row.bright_ti4) || null,
      frp:        parseFloat(row.frp)        || null,
      confidence: conf === 'h' || conf === 'high'    ? 'high'
                : conf === 'n' || conf === 'nominal'  ? 'nominal'
                : conf,
      satellite:  row.satellite || SOURCE,
      acq_date:   row.acq_date  || null,
      acq_time:   row.acq_time  || null,
      daynight:   row.daynight  || null,
    })
  }
  return rows
}

// ── Fetch one FIRMS area CSV ──────────────────────────────────────────────────
async function fetchFirmsArea(bbox) {
  const url = `${BASE_URL}/${MAP_KEY}/${SOURCE}/${bbox}/${DAYS}`
  try {
    const res = await axios.get(url, {
      timeout:      30000,
      responseType: 'text',
      headers: { 'User-Agent': 'ThreatWatch/1.0 (conflict monitoring research)' },
    })
    if (typeof res.data !== 'string') return []
    if (res.data.includes('Invalid') || res.data.includes('Error')) {
      console.warn(`[firms] API error for bbox ${bbox}:`, res.data.substring(0, 100))
      return []
    }
    return parseFirmsCSV(res.data)
  } catch (err) {
    console.warn(`[firms] fetch failed for bbox ${bbox}:`, err.message)
    return []
  }
}

// ── Upsert fires + cross-reference with UCDP events via PostGIS ──────────────
async function upsertFires(fires) {
  if (!fires.length) return 0

  const client = await pool.connect()
  let inserted = 0

  try {
    await client.query('BEGIN')

    for (const f of fires) {
      if (!f.acq_date) continue

      // All fires fetched are already from conflict-zone bboxes — mark as in_conflict_zone.
      // Optionally cross-reference nearest UCDP event (no temporal restriction since UCDP
      // data is historical 1989-2018 and FIRMS is real-time 2026).
      const xref = await client.query(`
        SELECT id
        FROM events
        WHERE source = 'UCDP'
          AND geom IS NOT NULL
          AND ST_DWithin(
            geom::geography,
            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
            50000
          )
        ORDER BY ST_Distance(
          geom::geography,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        )
        LIMIT 1
      `, [f.latitude, f.longitude])

      const nearestEventId = xref.rows[0]?.id || null
      // Always TRUE — fires are fetched from known conflict-zone bounding boxes
      const inConflictZone = true

      const res = await client.query(`
        INSERT INTO thermal_anomalies
          (latitude, longitude, brightness, frp, confidence, satellite,
           acq_date, acq_time, daynight, in_conflict_zone, nearest_event_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (satellite, acq_date, latitude, longitude) DO UPDATE
          SET in_conflict_zone = EXCLUDED.in_conflict_zone,
              nearest_event_id = EXCLUDED.nearest_event_id,
              frp              = EXCLUDED.frp
        RETURNING (xmax = 0) AS was_inserted
      `, [
        f.latitude, f.longitude, f.brightness, f.frp, f.confidence, f.satellite,
        f.acq_date, f.acq_time, f.daynight, inConflictZone, nearestEventId,
      ])

      if (res.rows[0]?.was_inserted) inserted++
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

// ── Get dynamic conflict bboxes from conflicts table ─────────────────────────
// Falls back to CONFLICT_BBOXES when DB is empty (no UCDP load yet).
async function getConflictBboxes() {
  try {
    const res = await pool.query(`
      SELECT DISTINCT c.countries[1] AS country
      FROM conflicts c
      WHERE c.status = 'confirmed'
        AND c.last_event_date >= NOW() - INTERVAL '90 days'
      LIMIT 30
    `)

    if (res.rows.length === 0) {
      console.log('[firms] no active conflicts in DB — using built-in conflict zone list')
      return CONFLICT_BBOXES
    }

    // Return built-in list (already comprehensive) — could be extended here
    // to compute bboxes from geo_boundaries join if that table is populated
    return CONFLICT_BBOXES
  } catch {
    return CONFLICT_BBOXES
  }
}

// ── Main export: ingest FIRMS data for all conflict zones ─────────────────────
export async function ingestFIRMS() {
  if (!MAP_KEY) {
    console.warn('[firms] FIRMS_API_KEY not set — skipping ingest.')
    console.warn('[firms] Register free at https://firms.modaps.eosdis.nasa.gov/api/')
    return { inserted: 0, fires: 0, conflictFires: 0 }
  }

  const bboxes = await getConflictBboxes()
  console.log(`[firms] fetching VIIRS data for ${bboxes.length} conflict zones...`)

  let totalFires    = 0
  let totalInserted = 0

  for (const zone of bboxes) {
    const fires = await fetchFirmsArea(zone.bbox)
    if (!fires.length) continue

    console.log(`[firms] ${zone.name}: ${fires.length} fires`)
    totalFires += fires.length

    const n = await upsertFires(fires)
    totalInserted += n

    // Brief pause between zones to respect FIRMS rate limits
    await new Promise(r => setTimeout(r, 500))
  }

  // Count how many fires are in conflict zones
  const conflictCount = await pool.query(
    `SELECT COUNT(*) FROM thermal_anomalies
     WHERE in_conflict_zone = TRUE
       AND acq_date >= NOW() - INTERVAL '${DAYS + 1} days'`
  )
  const conflictFires = parseInt(conflictCount.rows[0].count)

  // Flush stale fires cache + refresh mv_firms_conflict_summary (rule 12)
  if (totalInserted > 0) {
    onFirmsIngest(pool).catch(err =>
      console.warn('[firms] cache invalidation failed:', err.message)
    )
  }

  console.log(`[firms] ingest complete: ${totalFires} fires fetched, ${totalInserted} new, ${conflictFires} in conflict zones`)
  return { inserted: totalInserted, fires: totalFires, conflictFires }
}

// ── Stats query used by sidebar / context routes ──────────────────────────────
export async function getFirmsStats({ days = 7 } = {}) {
  const res = await pool.query(`
    SELECT
      COUNT(*)                                          AS total_anomalies,
      COUNT(*) FILTER (WHERE in_conflict_zone = TRUE)  AS conflict_anomalies,
      ROUND(AVG(frp)::NUMERIC, 1)                      AS avg_frp,
      ROUND(MAX(frp)::NUMERIC, 1)                      AS max_frp,
      MIN(acq_date)                                    AS from_date,
      MAX(acq_date)                                    AS to_date
    FROM thermal_anomalies
    WHERE acq_date >= NOW() - ($1 || ' days')::INTERVAL
  `, [days])
  return res.rows[0]
}

// ── Per-country fire counts (for sidebar "Top: Ukraine(47), Sudan(38)") ───────
export async function getFirmsTopCountries({ days = 1 } = {}) {
  // Join fires to events to get country names for conflict-zone fires
  const res = await pool.query(`
    SELECT e.country, COUNT(DISTINCT ta.id) AS fire_count
    FROM thermal_anomalies ta
    JOIN events e ON e.id = ta.nearest_event_id
    WHERE ta.in_conflict_zone = TRUE
      AND ta.acq_date >= NOW() - ($1 || ' days')::INTERVAL
    GROUP BY e.country
    ORDER BY fire_count DESC
    LIMIT 10
  `, [days])
  return res.rows
}
