import express        from 'express'
import { queryEvents, queryEventsNear } from '../ingestion/gdelt.js'
import pool           from '../db/pool.js'

const router = express.Router()

// GET /api/events
// Query params: limit, country, type, from, to
router.get('/', async (req, res) => {
  try {
    const country = req.query.country || null
    const type    = req.query.type    || null
    const from    = req.query.from    || null
    const to      = req.query.to      || null

    const events = await queryEvents({ country, type, dateFrom: from, dateTo: to })
    res.json({ status: 200, count: events.length, events })
  } catch (err) {
    console.error('[events] error:', err.message)
    res.status(500).json({ status: 500, error: err.message })
  }
})

// GET /api/events/stats
router.get('/stats', async (req, res) => {
  try {
    const [totals, countries, types, monthly] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) AS total, COALESCE(SUM(fatal), 0) AS fatalities
        FROM events
      `),
      pool.query(`
        SELECT country, COUNT(*) AS count, COALESCE(SUM(fatal), 0) AS fatalities
        FROM events
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT type, COUNT(*) AS count
        FROM events
        GROUP BY type
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT
          TO_CHAR(date, 'YYYY-MM') AS month,
          COUNT(*)                  AS events,
          COALESCE(SUM(fatal), 0)   AS fatalities
        FROM events
        GROUP BY month
        ORDER BY month
      `),
    ])

    const byType = {}
    types.rows.forEach(r => { byType[r.type] = parseInt(r.count) })

    res.json({
      status:       200,
      total:        parseInt(totals.rows[0].total),
      fatalities:   parseInt(totals.rows[0].fatalities),
      topCountries: countries.rows.map(r => ({
        country:    r.country,
        count:      parseInt(r.count),
        fatalities: parseInt(r.fatalities),
      })),
      byType,
      monthlyTrend: monthly.rows.map(r => ({
        month:      r.month,
        events:     parseInt(r.events),
        fatalities: parseInt(r.fatalities),
      })),
    })
  } catch (err) {
    console.error('[events/stats] error:', err.message)
    res.status(500).json({ status: 500, error: err.message })
  }
})

// GET /api/events/near?lat=31.5&lng=34.5&radius=200&limit=500
router.get('/near', async (req, res) => {
  try {
    const lat      = parseFloat(req.query.lat)
    const lng      = parseFloat(req.query.lng)
    const radiusKm = parseFloat(req.query.radius) || 200
    const limit    = parseInt(req.query.limit)     || 500

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ status: 400, error: 'lat and lng are required' })
    }

    const events = await queryEventsNear({ lat, lng, radiusKm, limit })
    res.json({ status: 200, center: { lat, lng }, radiusKm, count: events.length, events })
  } catch (err) {
    console.error('[events/near] error:', err.message)
    res.status(500).json({ status: 500, error: err.message })
  }
})

// GET /api/events/countries
router.get('/countries', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT country, COUNT(*) AS count
      FROM events
      GROUP BY country
      ORDER BY count DESC
    `)
    res.json({
      status:    200,
      countries: result.rows.map(r => ({ country: r.country, count: parseInt(r.count) })),
    })
  } catch (err) {
    console.error('[events/countries] error:', err.message)
    res.status(500).json({ status: 500, error: err.message })
  }
})

export default router