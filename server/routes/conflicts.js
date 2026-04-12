import express from 'express'
import pool from '../db.js'
import { cacheMiddleware } from '../cache.js'

const router = express.Router()

// ── GET /api/conflicts ────────────────────────────────────────────────────────
// Query params: status, sort, country, limit, offset
// Cache: 10 min — changes after classifier runs
router.get('/',
  cacheMiddleware(
    req => `conflicts:${req.query.status||'all'}:${req.query.sort||'escalation_score'}:${req.query.country||''}`,
    600   // 10 min
  ),
  async (req, res) => {
  try {
    const { status, country } = req.query
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0

    const SORT_COLS = {
      escalation_score: 'escalation_score',
      event_count:      'event_count',
      fatality_count:   'fatality_count',
      last_event_date:  'last_event_date',
    }
    const sort = SORT_COLS[req.query.sort] || 'escalation_score'

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

    params.push(limit, offset)
    const result = await pool.query(`
      SELECT
        id, title, status, countries, actors,
        war_start_date, map_center_lat AS "centerLat",
        map_center_lng AS "centerLng", map_zoom AS "mapZoom",
        event_count, fatality_count, last_event_date,
        escalation_score, confidence, created_at, updated_at
      FROM conflicts
      WHERE ${conds.join(' AND ')}
      ORDER BY ${sort} DESC NULLS LAST
      LIMIT $${i++} OFFSET $${i++}
    `, params)

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
