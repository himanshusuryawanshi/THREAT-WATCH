import express        from 'express'
import { fetchACLED } from '../services/acled.js'
import { fetchGDELT } from '../services/gdelt.js'
import { cacheStats } from '../cache/memory.js'

const router = express.Router()

// GET /api/events
router.get('/', async (req, res) => {
  try {
    const source = req.query.source || 'acled'
    const limit  = parseInt(req.query.limit) || 3000

    let events = []

    if (source === 'acled') {
      const all = await fetchACLED()
      events    = all.slice(0, limit)
    } else if (source === 'gdelt') {
      events = await fetchGDELT({ limit })
    } else if (source === 'both') {
      const [acled, gdelt] = await Promise.all([
        fetchACLED(),
        fetchGDELT({ limit: 100 }),
      ])
      events = [...acled, ...gdelt].slice(0, limit)
    }

    res.json({
      status: 200,
      source,
      count:  events.length,
      events,
    })
  } catch (err) {
    console.error('[events] error:', err.message)
    res.status(500).json({ status: 500, error: err.message })
  }
})

// GET /api/events/stats
router.get('/stats', async (req, res) => {
  try {
    const events    = await fetchACLED()
    const countries = {}
    const types     = {}

    events.forEach(e => {
      countries[e.country] = (countries[e.country] || 0) + 1
      types[e.type]        = (types[e.type]        || 0) + 1
    })

    const topCountries = Object.entries(countries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }))

    res.json({
      status:       200,
      total:        events.length,
      topCountries,
      byType:       types,
      cache:        cacheStats(),
    })
  } catch (err) {
    res.status(500).json({ status: 500, error: err.message })
  }
})

export default router