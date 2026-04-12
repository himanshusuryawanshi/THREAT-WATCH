import express from 'express'
import pool from '../db.js'
import { cacheMiddleware } from '../cache.js'

const router = express.Router()

// ── GET /api/fires ────────────────────────────────────────────────────────────
// Query params: bbox, days (default 7), conflict_only (bool), limit, offset
// Cache: 15 min — matches FIRMS poll frequency (blueprint TTL table)
router.get('/',
  cacheMiddleware(
    req => `fires:${req.query.bbox||'global'}:${req.query.days||7}:${req.query.conflict_only||false}`,
    900   // 15 min
  ),
  async (req, res) => {
  try {
    const days         = Math.min(parseInt(req.query.days) || 7, 30)
    const conflictOnly = req.query.conflict_only === 'true'
    const limit        = Math.min(parseInt(req.query.limit)  || 2000, 10000)
    const offset       = parseInt(req.query.offset) || 0

    const conds  = [`acq_date >= NOW() - ($1 || ' days')::INTERVAL`]
    const params = [days]
    let   i      = 2

    if (conflictOnly) {
      conds.push(`in_conflict_zone = TRUE`)
    }

    if (req.query.bbox) {
      const [west, south, east, north] = req.query.bbox.split(',').map(Number)
      conds.push(`ST_Within(geom, ST_MakeEnvelope($${i++},$${i++},$${i++},$${i++},4326))`)
      params.push(west, south, east, north)
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM thermal_anomalies WHERE ${conds.join(' AND ')}`,
      params
    )
    const total = parseInt(countResult.rows[0].count)

    params.push(limit, offset)
    const result = await pool.query(`
      SELECT
        id, latitude AS lat, longitude AS lng,
        brightness, frp, confidence, satellite,
        acq_date, acq_time, daynight,
        in_conflict_zone AS "inConflictZone",
        nearest_event_id AS "nearestEventId"
      FROM thermal_anomalies
      WHERE ${conds.join(' AND ')}
      ORDER BY acq_date DESC, frp DESC NULLS LAST
      LIMIT $${i++} OFFSET $${i++}
    `, params)

    res.json({ fires: result.rows, total, limit, offset })
  } catch (err) {
    console.error('[fires] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/fires/stats ──────────────────────────────────────────────────────
// Returns per-country fire counts — reads from mv_firms_conflict_summary (rule 13)
// Cache: 15 min
router.get('/stats',
  cacheMiddleware(req => `fires:stats:${req.query.timeframe||'7d'}`, 900),
  async (req, res) => {
  try {
    const days = req.query.timeframe === '30d' ? 30 : 7

    // Use materialized view for the 7-day country summary (rule 13)
    // Fall back to live query for non-7d timeframes
    let byCountry
    if (days === 7) {
      byCountry = await pool.query(
        `SELECT country, fire_count, fire_count AS conflict_fires, avg_frp, max_frp
         FROM mv_firms_conflict_summary`
      )
    } else {
      byCountry = await pool.query(`
        SELECT
          e.country,
          COUNT(ta.id)                         AS fire_count,
          COUNT(ta.id) FILTER (WHERE ta.in_conflict_zone) AS conflict_fires,
          AVG(ta.frp)                          AS avg_frp,
          MAX(ta.frp)                          AS max_frp
        FROM thermal_anomalies ta
        LEFT JOIN events e ON e.id = ta.nearest_event_id
        WHERE ta.acq_date >= NOW() - ($1 || ' days')::INTERVAL
          AND e.country IS NOT NULL
        GROUP BY e.country
        ORDER BY fire_count DESC
        LIMIT 20
      `, [days])
    }

    const totals = await pool.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE in_conflict_zone)             AS conflict_zone,
        AVG(frp)                                             AS avg_frp,
        MAX(frp)                                             AS max_frp,
        COUNT(*) FILTER (WHERE confidence = 'high')          AS high_confidence
      FROM thermal_anomalies
      WHERE acq_date >= NOW() - ($1 || ' days')::INTERVAL
    `, [days])

    const t = totals.rows[0]
    res.json({
      total:           parseInt(t.total),
      conflict_zone:   parseInt(t.conflict_zone),
      avg_frp:         parseFloat(t.avg_frp) || null,
      max_frp:         parseFloat(t.max_frp) || null,
      high_confidence: parseInt(t.high_confidence),
      by_country: byCountry.rows.map(r => ({
        country:        r.country,
        fire_count:     parseInt(r.fire_count),
        conflict_fires: parseInt(r.conflict_fires),
        avg_frp:        parseFloat(r.avg_frp) || null,
        max_frp:        parseFloat(r.max_frp) || null,
      })),
    })
  } catch (err) {
    console.error('[fires/stats] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
