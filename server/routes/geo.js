import express from 'express'
import pool from '../db.js'
import { cacheMiddleware } from '../cache.js'
import { geoBoundariesCache } from '../lruCache.js'

const router = express.Router()

// ── GET /api/geo/choropleth ───────────────────────────────────────────────────
// Returns per-country aggregated stats for choropleth coloring.
// Params: timeframe=30d|7d|90d|1y  OR  from=YYYY-MM-DD&to=YYYY-MM-DD
// Cache: 1 hour Redis (heavy join, slow-changing)
router.get('/choropleth',
  cacheMiddleware(
    req => `choropleth:${req.query.timeframe || '30d'}:${req.query.from || ''}:${req.query.to || ''}`,
    3600
  ),
  async (req, res) => {
  try {
    const { timeframe, from, to } = req.query

    // ── Custom date range ──────────────────────────────────────────────────
    if (from && to) {
      const result = await pool.query(`
        SELECT
          country,
          COUNT(*)                         AS event_count,
          COALESCE(SUM(fatalities), 0)     AS fatalities,
          MAX(date)                        AS last_event_date
        FROM events
        WHERE source IN ('UCDP','UCDP_CANDIDATE')
          AND date >= $1 AND date <= $2
          AND country IS NOT NULL
        GROUP BY country
        ORDER BY event_count DESC
      `, [from, to])
      return res.json({
        timeframe: 'custom',
        countries: result.rows.map(r => ({
          country:         r.country,
          event_count:     parseInt(r.event_count) || 0,
          fatalities:      parseInt(r.fatalities)  || 0,
          last_event_date: r.last_event_date,
        })),
      })
    }

    const tf = timeframe || '30d'

    // ── 30d default — use materialized view (instant) ──────────────────────
    if (tf === '30d') {
      const result = await pool.query(
        `SELECT country, events AS event_count, fatalities, last_event_date
         FROM mv_choropleth
         ORDER BY events DESC`
      )
      return res.json({
        timeframe: '30d',
        countries: result.rows.map(r => ({
          country:         r.country,
          event_count:     parseInt(r.event_count) || 0,
          fatalities:      parseInt(r.fatalities)  || 0,
          last_event_date: r.last_event_date,
        })),
        _source: 'materialized_view',
      })
    }

    // ── Other presets — anchor to MAX(date) like /api/events ──────────────
    const DAYS = { '7d': 7, '90d': 90, '1y': 365 }
    const days = DAYS[tf] || 30

    const result = await pool.query(`
      SELECT
        country,
        COUNT(*)                         AS event_count,
        COALESCE(SUM(fatalities), 0)     AS fatalities,
        MAX(date)                        AS last_event_date
      FROM events
      WHERE source IN ('UCDP','UCDP_CANDIDATE')
        AND date >= (SELECT MAX(date) FROM events) - ($1 || ' days')::INTERVAL
        AND country IS NOT NULL
      GROUP BY country
      ORDER BY event_count DESC
    `, [days])

    res.json({
      timeframe: tf,
      countries: result.rows.map(r => ({
        country:         r.country,
        event_count:     parseInt(r.event_count) || 0,
        fatalities:      parseInt(r.fatalities)  || 0,
        last_event_date: r.last_event_date,
      })),
    })
  } catch (err) {
    console.error('[geo/choropleth] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/geo/boundaries ───────────────────────────────────────────────────
// Natural Earth country boundaries — static data, cached 24h LRU + Redis
router.get('/boundaries',
  cacheMiddleware('boundaries:countries', 86400),  // 24 hours Redis
  async (_req, res) => {
  // Check LRU first (even faster than Redis)
  const lruHit = geoBoundariesCache.get('countries')
  if (lruHit) return res.json(lruHit)

  try {
    const result = await pool.query(`
      SELECT name, iso_a3, feature_type,
             ST_AsGeoJSON(geom)::JSONB AS geometry
      FROM geo_boundaries
      WHERE feature_type = 'country'
      LIMIT 300
    `)
    const fc = {
      type: 'FeatureCollection',
      features: result.rows.map(r => ({
        type: 'Feature',
        properties: { name: r.name, iso_a3: r.iso_a3 },
        geometry:   r.geometry,
      })),
    }
    geoBoundariesCache.set('countries', fc)
    res.json(fc)
  } catch (err) {
    // Table may not be populated yet — return empty FeatureCollection
    res.json({ type: 'FeatureCollection', features: [] })
  }
})

export default router
