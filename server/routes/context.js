import express from 'express'
import pool from '../db.js'
import { cacheMiddleware } from '../cache.js'

const router = express.Router()

// ── GET /api/context/breaking ─────────────────────────────────────────────────
// Latest GDELT articles for the breaking news ticker
// Cache: 5 min — fresh news matters but GDELT updates every 15 min
router.get('/breaking',
  cacheMiddleware('breaking:latest', 300),
  async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50)
    const result = await pool.query(`
      SELECT id, title, source_name, source_country, language,
             published_at, tone, gdelt_url AS url
      FROM articles
      WHERE title IS NOT NULL
        AND (language = 'English' OR language IS NULL)
      ORDER BY published_at DESC NULLS LAST, created_at DESC
      LIMIT $1
    `, [limit])
    res.json({ articles: result.rows })
  } catch (err) {
    console.error('[context/breaking] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/context/humanitarian ────────────────────────────────────────────
// Global humanitarian summary: total reports, displaced, affected, active crises
// Cache: 15 min — updates with reliefweb ingest
router.get('/humanitarian',
  cacheMiddleware('humanitarian:global', 900),
  async (req, res) => {
  try {
    const [agg, recent, disasters] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_reports,
          COALESCE(SUM(people_affected),  0) AS total_affected,
          COALESCE(SUM(people_displaced), 0) AS total_displaced,
          COUNT(DISTINCT country)            AS countries_affected
        FROM humanitarian
        WHERE status IN ('ongoing', 'current')
      `),
      pool.query(`
        SELECT country, title, summary, people_affected, people_displaced, published_at, url
        FROM humanitarian
        WHERE status = 'ongoing'
          AND title IS NOT NULL
        ORDER BY published_at DESC NULLS LAST
        LIMIT 5
      `),
      pool.query(`
        SELECT COUNT(*) AS active_disasters
        FROM humanitarian
        WHERE disaster_type != 'Armed Conflict' AND status = 'current'
      `),
    ])

    const stats = agg.rows[0]
    res.json({
      total_reports:      parseInt(stats.total_reports)       || 0,
      total_affected:     parseInt(stats.total_affected)      || 0,
      total_displaced:    parseInt(stats.total_displaced)     || 0,
      countries_affected: parseInt(stats.countries_affected)  || 0,
      active_disasters:   parseInt(disasters.rows[0].active_disasters) || 0,
      recent_reports:     recent.rows,
    })
  } catch (err) {
    console.error('[context/humanitarian] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/context/country/:countryName ─────────────────────────────────────
router.get('/country/:countryName',
  cacheMiddleware(req => `context:country:${req.params.countryName.toLowerCase()}`, 300),
  async (req, res) => {
  try {
    const country = decodeURIComponent(req.params.countryName)

    const [articles, humanitarian, conflicts] = await Promise.all([
      pool.query(`
        SELECT id, title, source_name, published_at, tone, gdelt_url AS url
        FROM articles
        WHERE title ILIKE $1 OR source_country ILIKE $2
        ORDER BY published_at DESC NULLS LAST
        LIMIT 10
      `, [`%${country}%`, `%${country}%`]),

      pool.query(`
        SELECT id, title, summary, people_affected, people_displaced,
               published_at, url
        FROM humanitarian
        WHERE country ILIKE $1
        ORDER BY published_at DESC NULLS LAST
        LIMIT 5
      `, [country]),

      pool.query(`
        SELECT id, title, status, event_count, fatality_count
        FROM conflicts
        WHERE $1 = ANY(countries)
        ORDER BY event_count DESC NULLS LAST
        LIMIT 5
      `, [country]),
    ])

    const agg = humanitarian.rows.reduce((acc, r) => ({
      people_affected:  acc.people_affected  + (parseInt(r.people_affected)  || 0),
      people_displaced: acc.people_displaced + (parseInt(r.people_displaced) || 0),
    }), { people_affected: 0, people_displaced: 0 })

    res.json({
      gdelt_articles:      articles.rows,
      reliefweb_reports:   humanitarian.rows,
      crisis_figures:      agg,
      active_conflicts:    conflicts.rows,
    })
  } catch (err) {
    console.error('[context/country] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/context/sentiment/:conflictId ────────────────────────────────────
router.get('/sentiment/:conflictId',
  cacheMiddleware(req => `tone:${req.params.conflictId}:${req.query.timeframe||'30d'}`, 1800),
  async (req, res) => {
  try {
    const days = req.query.timeframe === '90d' ? 90 : 30
    const result = await pool.query(`
      SELECT
        DATE_TRUNC('day', published_at)::DATE AS date,
        AVG(tone)   AS avg_tone,
        COUNT(*)    AS article_count
      FROM articles
      WHERE conflict_id = $1
        AND published_at >= NOW() - ($2 || ' days')::INTERVAL
        AND tone IS NOT NULL
      GROUP BY DATE_TRUNC('day', published_at)
      ORDER BY date
    `, [req.params.conflictId, days])

    res.json({
      trend: result.rows.map(r => ({
        date:          r.date,
        avg_tone:      parseFloat(r.avg_tone),
        article_count: parseInt(r.article_count),
      })),
    })
  } catch (err) {
    console.error('[context/sentiment] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
