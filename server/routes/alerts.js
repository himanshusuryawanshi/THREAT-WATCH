import express from 'express'
import pool from '../db.js'
import { cacheMiddleware } from '../cache.js'

const router = express.Router()

// ── GET /api/alerts ───────────────────────────────────────────────────────────
// Query params: severity, country, conflict_id, resolved (bool), limit, offset
// Cache: 5 min — alert panels refresh frequently
router.get('/',
  cacheMiddleware(
    req => `alerts:${req.query.severity||'all'}:${req.query.resolved||'any'}:${req.query.country||''}`,
    300
  ),
  async (req, res) => {
  try {
    const { severity, country, conflict_id } = req.query
    const resolved = req.query.resolved === 'true'
                     ? true
                     : req.query.resolved === 'false'
                       ? false
                       : null
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0

    const conds  = ['1=1']
    const params = []
    let   i      = 1

    if (severity) {
      conds.push(`severity = $${i++}`); params.push(severity)
    }
    if (country) {
      conds.push(`country ILIKE $${i++}`); params.push(country)
    }
    if (conflict_id) {
      conds.push(`conflict_id = $${i++}`); params.push(conflict_id)
    }
    if (resolved !== null) {
      conds.push(`resolved = $${i++}`); params.push(resolved)
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM alerts WHERE ${conds.join(' AND ')}`,
      params
    )
    const total = parseInt(countResult.rows[0].count)

    params.push(limit, offset)
    const result = await pool.query(`
      SELECT
        id, alert_type, severity, country, conflict_id,
        title, description, signal_data, resolved, created_at
      FROM alerts
      WHERE ${conds.join(' AND ')}
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'elevated' THEN 2
          WHEN 'watch'    THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT $${i++} OFFSET $${i++}
    `, params)

    // Severity summary counts for dashboard badge
    const summary = await pool.query(`
      SELECT severity, COUNT(*) AS count
      FROM alerts
      WHERE resolved = FALSE
      GROUP BY severity
    `)
    const severityCounts = { critical: 0, elevated: 0, watch: 0 }
    summary.rows.forEach(r => {
      if (r.severity in severityCounts) {
        severityCounts[r.severity] = parseInt(r.count)
      }
    })

    res.json({
      alerts: result.rows,
      total,
      limit,
      offset,
      summary: severityCounts,
    })
  } catch (err) {
    console.error('[alerts] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/alerts/country/:name ─────────────────────────────────────────────
router.get('/country/:name',
  cacheMiddleware(req => `alerts:country:${req.params.name.toLowerCase()}`, 300),
  async (req, res) => {
  try {
    const country = decodeURIComponent(req.params.name)
    const result  = await pool.query(`
      SELECT
        id, alert_type, severity, country, conflict_id,
        title, description, signal_data, resolved, created_at
      FROM alerts
      WHERE country ILIKE $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [country])

    res.json({ alerts: result.rows })
  } catch (err) {
    console.error('[alerts/country] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
