import express from 'express'
import pool from '../db.js'
import { cacheMiddleware } from '../cache.js'
import { bboxCache } from '../lruCache.js'

const router = express.Router()

// ── helpers ──────────────────────────────────────────────────────────────────
const TIMEFRAME_DAYS = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }

function daysInterval(tf) {
  return TIMEFRAME_DAYS[tf] || 30
}

// ── GET /api/events ───────────────────────────────────────────────────────────
// Query params: source, type, country, conflict_id, date_from, date_to,
//               min_precision, bbox, limit (default 500, max 5000), offset
// Cache: bbox queries → LRU 2min; all others → Redis 5min
router.get('/',
  cacheMiddleware(
    req => {
      const { source, type, country, bbox, from, date_from, to, date_to, actor, timeframe } = req.query
      return `events:${source||'all'}:${country||''}:${type||''}:${bbox||''}:${from||date_from||''}:${to||date_to||''}:${actor||''}:${timeframe||''}`
    },
    300   // 5 min
  ),
  async (req, res) => {
  try {
    const {
      source, type, country, conflict_id,
      date_from, date_to, from, to,
      min_precision, bbox, timeframe,
    } = req.query
    const limit  = Math.min(parseInt(req.query.limit)  || 500,  5000)
    const offset = parseInt(req.query.offset) || 0

    const conds  = ['1=1']
    const params = []
    let   i      = 1

    if (source && source !== 'all') {
      // 'ucdp' includes both verified GED and candidate monthly releases
      if (source.toLowerCase() === 'ucdp') {
        conds.push(`source IN ('UCDP', 'UCDP_CANDIDATE')`)
      } else {
        conds.push(`source = $${i++}`); params.push(source.toUpperCase())
      }
    }
    if (type) {
      conds.push(`type = $${i++}`); params.push(type)
    }
    if (country) {
      conds.push(`country ILIKE $${i++}`); params.push(country)
    }
    if (conflict_id) {
      conds.push(`conflict_id = $${i++}`); params.push(conflict_id)
    }
    if (req.query.actor) {
      conds.push(`(actor1 ILIKE $${i++} OR actor2 ILIKE $${i++})`)
      const a = `%${req.query.actor}%`
      params.push(a, a)
    }

    // timeframe=30d anchors to MAX(date) in DB, not NOW() — handles UCDP's ~2 month lag
    if (timeframe) {
      const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[timeframe]
      if (days) {
        conds.push(`date >= (SELECT MAX(date) FROM events) - ($${i++} || ' days')::INTERVAL`)
        params.push(days)
      }
    }

    // Accept both ?from= and ?date_from= (explicit date range overrides timeframe)
    const df = date_from || from
    const dt = date_to   || to
    if (df) { conds.push(`date >= $${i++}`); params.push(df) }
    if (dt) { conds.push(`date <= $${i++}`); params.push(dt) }

    if (min_precision) {
      conds.push(`geo_precision <= $${i++}`); params.push(parseInt(min_precision))
    }
    if (bbox) {
      const [west, south, east, north] = bbox.split(',').map(Number)
      conds.push(`ST_Within(geom, ST_MakeEnvelope($${i++},$${i++},$${i++},$${i++},4326))`)
      params.push(west, south, east, north)
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM events WHERE ${conds.join(' AND ')}`,
      params
    )
    const total = parseInt(countResult.rows[0].count)

    params.push(limit, offset)
    const result = await pool.query(`
      SELECT
        id, source, source_id, date, type, subtype,
        country, admin1, location, lat, lng,
        origin_lat AS "originLat", origin_lng AS "originLng",
        geo_precision AS "geoPrecision",
        actor1, actor2, fatalities, fatalities_low, fatalities_high,
        notes, url, tone, goldstein, conflict_id, disorder
      FROM events
      WHERE ${conds.join(' AND ')}
      ORDER BY date DESC
      LIMIT $${i++} OFFSET $${i++}
    `, params)

    res.json({ events: result.rows, total, limit, offset })
  } catch (err) {
    console.error('[events] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/events/stats ─────────────────────────────────────────────────────
// Query params: country, conflict_id, timeframe ('7d'|'30d'|'90d'|'1y'),
//               from=YYYY-MM-DD, to=YYYY-MM-DD, source
// Cache: 5 min
router.get('/stats',
  cacheMiddleware(
    req => `stats:${req.query.country||'global'}:${req.query.timeframe||'30d'}:${req.query.from||''}:${req.query.to||''}:${req.query.conflict_id||''}`,
    300
  ),
  async (req, res) => {
  try {
    const { from, to } = req.query

    // Build date condition — custom range takes priority over preset
    let conds, params, i
    if (from && to) {
      conds  = [`date >= $1`, `date <= $2`]
      params = [from, to]
      i      = 3
    } else {
      const days = daysInterval(req.query.timeframe)
      conds  = [`date >= (SELECT MAX(date) FROM events WHERE source='UCDP') - ($1 || ' days')::INTERVAL`]
      params = [days]
      i      = 2
    }

    if (req.query.country) {
      conds.push(`country ILIKE $${i++}`); params.push(req.query.country)
    }
    if (req.query.conflict_id) {
      conds.push(`conflict_id = $${i++}`); params.push(req.query.conflict_id)
    }
    if (req.query.source && req.query.source !== 'all') {
      if (req.query.source.toLowerCase() === 'ucdp') {
        conds.push(`source IN ('UCDP', 'UCDP_CANDIDATE')`)
      } else {
        conds.push(`source = $${i++}`); params.push(req.query.source.toUpperCase())
      }
    } else {
      // Default: UCDP + candidate for stats
      conds.push(`source IN ('UCDP', 'UCDP_CANDIDATE')`)
    }

    const where = conds.join(' AND ')

    // Use materialized views for 30d preset (fast path) — skip for custom ranges
    if (!req.query.conflict_id && !from && !to && (req.query.timeframe === '30d' || !req.query.timeframe)) {
      const [mvTotals, mvByType, byActor, trend] = await Promise.all([
        // mv_country_stats for top countries + totals (all-time; UCDP is historical)
        req.query.country
          ? pool.query(
              `SELECT total_events AS event_count, total_fatalities AS fatalities
               FROM mv_country_stats WHERE LOWER(country) = LOWER($1)`,
              [req.query.country])
          : pool.query(
              `SELECT COALESCE(SUM(total_events),0) AS event_count,
                      COALESCE(SUM(total_fatalities),0) AS fatalities
               FROM mv_country_stats`),
        // mv_event_breakdown for type counts
        pool.query(`SELECT type, count, fatalities FROM mv_event_breakdown`),
        // Still live for actor aggregation (low cardinality, fast)
        pool.query(
          `SELECT actor1 AS actor, COUNT(*) AS count
           FROM events WHERE ${where} AND actor1 IS NOT NULL AND actor1 != ''
           GROUP BY actor1 ORDER BY count DESC LIMIT 10`, params),
        // Daily trend — still live (time-series, can't pre-aggregate simply)
        pool.query(
          `SELECT date::TEXT AS date, COUNT(*) AS events,
                  COALESCE(SUM(fatalities),0) AS fatalities
           FROM events WHERE ${where}
           GROUP BY date ORDER BY date`, params),
      ])

      // Top countries from mv_top_countries
      const byCountryResult = await pool.query(
        req.query.country
          ? `SELECT country, events AS count, fatalities FROM mv_top_countries WHERE LOWER(country) = LOWER($1)`
          : `SELECT country, events AS count, fatalities FROM mv_top_countries LIMIT 10`,
        req.query.country ? [req.query.country] : []
      )

      const by_type = {}
      mvByType.rows.forEach(r => { by_type[r.type] = parseInt(r.count) })

      const totals = mvTotals.rows[0] || { event_count: 0, fatalities: 0 }
      return res.json({
        event_count: parseInt(totals.event_count) || 0,
        fatalities:  parseInt(totals.fatalities)  || 0,
        by_country:  byCountryResult.rows.map(r => ({
          country:    r.country,
          count:      parseInt(r.count),
          fatalities: parseInt(r.fatalities),
        })),
        by_type,
        by_actor: byActor.rows.map(r => ({
          actor: r.actor,
          count: parseInt(r.count),
        })),
        trend: trend.rows.map(r => ({
          date:       r.date,
          events:     parseInt(r.events),
          fatalities: parseInt(r.fatalities),
        })),
        _source: 'materialized_view',
      })
    }

    // Fallback: live query (conflict_id filter or non-30d timeframe)
    const [totals, byCountry, byType, byActor, trend] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS event_count, COALESCE(SUM(fatalities),0) AS fatalities
         FROM events WHERE ${where}`, params),
      pool.query(
        `SELECT country, COUNT(*) AS count, COALESCE(SUM(fatalities),0) AS fatalities
         FROM events WHERE ${where}
         GROUP BY country ORDER BY count DESC LIMIT 10`, params),
      pool.query(
        `SELECT type, COUNT(*) AS count
         FROM events WHERE ${where}
         GROUP BY type ORDER BY count DESC`, params),
      pool.query(
        `SELECT actor1 AS actor, COUNT(*) AS count
         FROM events WHERE ${where} AND actor1 IS NOT NULL AND actor1 != ''
         GROUP BY actor1 ORDER BY count DESC LIMIT 10`, params),
      pool.query(
        `SELECT date::TEXT AS date, COUNT(*) AS events,
                COALESCE(SUM(fatalities),0) AS fatalities
         FROM events WHERE ${where}
         GROUP BY date ORDER BY date`, params),
    ])

    const by_type = {}
    byType.rows.forEach(r => { by_type[r.type] = parseInt(r.count) })

    res.json({
      event_count: parseInt(totals.rows[0].event_count),
      fatalities:  parseInt(totals.rows[0].fatalities),
      by_country:  byCountry.rows.map(r => ({
        country:    r.country,
        count:      parseInt(r.count),
        fatalities: parseInt(r.fatalities),
      })),
      by_type,
      by_actor: byActor.rows.map(r => ({
        actor: r.actor,
        count: parseInt(r.count),
      })),
      trend: trend.rows.map(r => ({
        date:       r.date,
        events:     parseInt(r.events),
        fatalities: parseInt(r.fatalities),
      })),
    })
  } catch (err) {
    console.error('[events/stats] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/events/heatmap ───────────────────────────────────────────────────
// Returns GeoJSON FeatureCollection — GDELT events only (geo_precision >= 3)
router.get('/heatmap',
  cacheMiddleware(req => `heatmap:${req.query.timeframe||'30d'}:${req.query.type||''}`, 300),
  async (req, res) => {
  try {
    const days = daysInterval(req.query.timeframe)
    const conds  = [`date >= NOW() - ($1 || ' days')::INTERVAL`, `source = 'GDELT'`,
                    `lat IS NOT NULL`, `lng IS NOT NULL`]
    const params = [days]
    if (req.query.type) { conds.push(`type = $2`); params.push(req.query.type) }

    const result = await pool.query(
      `SELECT lat, lng, COALESCE(fatalities, 1) AS weight
       FROM events WHERE ${conds.join(' AND ')}
       LIMIT 10000`, params)

    res.json({
      type: 'FeatureCollection',
      features: result.rows.map(r => ({
        type:     'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: { weight: Math.max(parseInt(r.weight), 1) },
      })),
    })
  } catch (err) {
    console.error('[events/heatmap] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/events/arcs ──────────────────────────────────────────────────────
// Returns UCDP events with precise geo (geo_precision <= 2) for strike arcs
router.get('/arcs',
  cacheMiddleware(req => `arcs:${req.query.conflict_id||'all'}:${req.query.timeframe||'30d'}`, 600),
  async (req, res) => {
  try {
    const conds  = [
      `source = 'UCDP'`,
      `geo_precision <= 2`,
      `lat IS NOT NULL`, `lng IS NOT NULL`,
      `origin_lat IS NOT NULL`, `origin_lng IS NOT NULL`,
    ]
    const params = []
    let i = 1
    if (req.query.conflict_id) {
      conds.push(`conflict_id = $${i++}`); params.push(req.query.conflict_id)
    }

    const result = await pool.query(`
      SELECT id, date, lat, lng, origin_lat, origin_lng,
             fatalities, actor1, actor2, country, type, subtype
      FROM events
      WHERE ${conds.join(' AND ')}
      ORDER BY date DESC
      LIMIT 500
    `, params)

    res.json(result.rows.map(r => ({
      id:          r.id,
      origin:      [parseFloat(r.origin_lat), parseFloat(r.origin_lng)],
      destination: [parseFloat(r.lat),        parseFloat(r.lng)],
      date:        r.date,
      fatalities:  parseInt(r.fatalities) || 0,
      actor1:      r.actor1,
      actor2:      r.actor2,
      country:     r.country,
      type:        r.type,
    })))
  } catch (err) {
    console.error('[events/arcs] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/events/:id ───────────────────────────────────────────────────────
// Must be last — catches any :id that didn't match above named routes
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, source, source_id, date, type, subtype,
              country, admin1, location, lat, lng,
              origin_lat AS "originLat", origin_lng AS "originLng",
              geo_precision AS "geoPrecision",
              actor1, actor2, fatalities, fatalities_low, fatalities_high,
              notes, url, tone, goldstein, conflict_id, disorder,
              created_at, updated_at
       FROM events WHERE id = $1`,
      [req.params.id]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Event not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error('[events/:id] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
