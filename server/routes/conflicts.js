import express from 'express'
import pool from '../db.js'
import { cacheMiddleware } from '../cache.js'

const router = express.Router()

// ── GET /api/conflicts ────────────────────────────────────────────────────────
// Query params: status, sort, country, limit, offset
// Cache: 10 min — changes after classifier runs
router.get('/',
  cacheMiddleware(
    req => `conflicts:${req.query.status||'all'}:${req.query.country||''}:${req.query.timeframe||'90d'}:${req.query.from||''}:${req.query.to||''}`,
    600
  ),
  async (req, res) => {
  try {
    const { status, country, timeframe, from, to } = req.query
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0

    const SORT_COLS = {
      event_count:      'event_count',
      fatality_count:   'fatality_count',
      last_event_date:  'last_event_date',
    }
    const sort = SORT_COLS[req.query.sort] || 'event_count'

    const conds  = ['1=1']
    const params = []
    let   i      = 1

    if (status) {
      conds.push(`status = $${i++}`); params.push(status)
    }
    if (country) {
      conds.push(`$${i++} = ANY(countries)`); params.push(country)
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM conflicts WHERE ${conds.join(' AND ')}`,
      params
    )
    const total = parseInt(countResult.rows[0].count)

    // Build the lateral event-count date filter
    let lateralDateCond
    const lateralParams = [...params]  // copy so we can append date params after
    if (from && to) {
      lateralParams.push(from, to)
      lateralDateCond = `date >= $${lateralParams.length - 1}::date AND date <= $${lateralParams.length}::date`
    } else {
      const DAYS = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
      const days = DAYS[timeframe] || 90
      lateralParams.push(days)
      lateralDateCond = `date >= (SELECT MAX(date) FROM events) - ($${lateralParams.length} || ' days')::INTERVAL`
    }

    lateralParams.push(limit, offset)
    const limitIdx  = lateralParams.length - 1
    const offsetIdx = lateralParams.length

    const result = await pool.query(`
      SELECT
        c.id, c.title, c.status, c.countries, c.actors,
        c.war_start_date, c.map_center_lat AS "centerLat",
        c.map_center_lng AS "centerLng", c.map_zoom AS "mapZoom",
        COALESCE(ev.event_count,    0) AS event_count,
        COALESCE(ev.fatality_count, 0) AS fatality_count,
        ev.last_event_date,
        c.confidence, c.escalation_score, c.context_summary,
        c.created_at, c.updated_at
      FROM conflicts c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)                     AS event_count,
          COALESCE(SUM(fatalities), 0) AS fatality_count,
          MAX(date)                    AS last_event_date
        FROM events
        WHERE country = ANY(c.countries)
          AND ${lateralDateCond}
      ) ev ON true
      WHERE ${conds.join(' AND ')}
      ORDER BY ev.event_count DESC NULLS LAST
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, lateralParams)

    res.json({ conflicts: result.rows, total, limit, offset })
  } catch (err) {
    console.error('[conflicts] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/conflicts/:id ────────────────────────────────────────────────────
// Full conflict record + recent events + recent articles + 30-day timeline
router.get('/:id',
  cacheMiddleware(req => `conflicts:id:${req.params.id}`, 600),
  async (req, res) => {
  try {
    const { id } = req.params

    const conflictResult = await pool.query(
      `SELECT * FROM conflicts WHERE id = $1`,
      [id]
    )
    if (!conflictResult.rows.length) {
      return res.status(404).json({ error: 'Conflict not found' })
    }
    const conflict = conflictResult.rows[0]

    const [events, articles, timeline] = await Promise.all([
      // Latest 50 events for this conflict
      pool.query(`
        SELECT
          id, source, date, type, subtype, country, admin1, location,
          lat, lng, origin_lat AS "originLat", origin_lng AS "originLng",
          geo_precision AS "geoPrecision",
          actor1, actor2, fatalities, notes, url
        FROM events
        WHERE conflict_id = $1
        ORDER BY date DESC
        LIMIT 50
      `, [id]),

      // Latest 20 articles linked to this conflict
      pool.query(`
        SELECT
          id, title, source_name, source_country, language,
          published_at, tone, gdelt_url AS url
        FROM articles
        WHERE conflict_id = $1
          AND title IS NOT NULL
        ORDER BY published_at DESC NULLS LAST
        LIMIT 20
      `, [id]),

      // 30-day daily timeline: events + fatalities
      pool.query(`
        SELECT
          date::TEXT AS date,
          COUNT(*)                           AS events,
          COALESCE(SUM(fatalities), 0)       AS fatalities
        FROM events
        WHERE conflict_id = $1
          AND date >= NOW() - INTERVAL '30 days'
        GROUP BY date
        ORDER BY date
      `, [id]),
    ])

    res.json({
      conflict,
      events:   events.rows,
      articles: articles.rows,
      timeline: timeline.rows.map(r => ({
        date:       r.date,
        events:     parseInt(r.events),
        fatalities: parseInt(r.fatalities),
      })),
    })
  } catch (err) {
    console.error('[conflicts/:id] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
