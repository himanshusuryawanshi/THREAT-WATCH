import express         from 'express'
import cors            from 'cors'
import helmet          from 'helmet'
import compression     from 'compression'
import rateLimit       from 'express-rate-limit'
import dotenv          from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'
import eventsRouter    from './routes/events.js'
import contextRouter   from './routes/context.js'
import firesRouter     from './routes/fires.js'
import conflictsRouter from './routes/conflicts.js'
import geoRouter       from './routes/geo.js'
import alertsRouter        from './routes/alerts.js'
import displacementRouter  from './routes/displacement.js'
import { startGdeltPoller    } from './cron/gdeltPoller.js'
import { startUcdpPoller     } from './cron/ucdpPoller.js'
import { startFirmsPoller    } from './cron/firmsPoller.js'
import { startAlertsPoller    } from './cron/alertsPoller.js'
import { startReliefWebPoller } from './cron/reliefwebPoller.js'
import { startClassifierRunner } from './cron/classifierRunner.js'
import { startUnhcrPoller      } from './cron/unhcrPoller.js'
import pool          from './db.js'
import { redis }     from './cache.js'

dotenv.config({ path: '../.env' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const isProd    = process.env.NODE_ENV === 'production'
const app       = express()
const PORT      = process.env.PORT || 3001

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  // Relax CSP so Mapbox GL, Google Fonts, and CDN assets can load
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

// ── Gzip compression ──────────────────────────────────────────────────────────
app.use(compression())

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:  isProd
    ? (process.env.FRONTEND_URL || true)   // same-origin in prod when serving static
    : (process.env.FRONTEND_URL || 'http://localhost:5173'),
  methods: ['GET', 'POST', 'PATCH'],
}))

app.use(express.json())

// ── Global API rate limit: 200 req/min per IP ────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests — please slow down.' },
})
app.use('/api', apiLimiter)

// ── Tier 1 — UCDP event data (map dots, strike arcs) ──────────────────────────
app.use('/api/events',    eventsRouter)

// ── Tier 2 — GDELT intelligence (breaking news, sentiment) ────────────────────
app.use('/api/context',   contextRouter)

// ── Phase 1 — NASA FIRMS thermal anomalies ─────────────────────────────────────
app.use('/api/fires',     firesRouter)

// ── Phase 1 — Conflict records ─────────────────────────────────────────────────
app.use('/api/conflicts', conflictsRouter)

// ── Phase 1 — Geospatial (choropleth + boundaries) ────────────────────────────
app.use('/api/geo',       geoRouter)

// ── Phase 1 — Early warning alerts ────────────────────────────────────────────
app.use('/api/alerts',    alertsRouter)

// ── Phase 2 additions ─────────────────────────────────────────────────────────
app.use('/api/displacement', displacementRouter)          // UNHCR refugee flows
// TODO: app.use('/api/tone',         toneRouter)          — GDELT tone analytics

// ── Phase 3 additions ─────────────────────────────────────────────────────────
// TODO: app.use('/api/risk',     riskRouter)          — ThreatWatch risk scores
// TODO: app.use('/api/briefing', briefingRouter)      — Claude AI daily briefings

// ── Phase 4 additions ─────────────────────────────────────────────────────────
// TODO: app.use('/api/sanctions', sanctionsRouter)    — OpenSanctions data

// ── Health (simple liveness probe) ────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── Status dashboard ──────────────────────────────────────────────────────────
app.get('/api/status', async (_req, res) => {
  const status = {
    time:  new Date().toISOString(),
    env:   process.env.NODE_ENV || 'development',
    db:    { connected: false },
    redis: { connected: false },
    data:  {},
    crons: {
      ucdp:      'daily 02:00 UTC',
      gdelt:     'every 15 min',
      firms:     'every 3 h',
      alerts:    'every 6 h',
      reliefweb: 'every 6 h',
    },
  }

  // DB check
  try {
    const [events, lastEvent, articles, alerts, humanitarian, fires] =
      await Promise.all([
        pool.query('SELECT COUNT(*) FROM events'),
        pool.query('SELECT MAX(date) AS last FROM events'),
        pool.query('SELECT COUNT(*) FROM articles'),
        pool.query('SELECT COUNT(*) FROM alerts WHERE resolved = FALSE'),
        pool.query('SELECT COUNT(*) FROM humanitarian'),
        pool.query('SELECT COUNT(*) FROM thermal_anomalies'),
      ])

    status.db.connected = true
    status.data = {
      events:      parseInt(events.rows[0].count),
      last_event:  lastEvent.rows[0].last,
      articles:    parseInt(articles.rows[0].count),
      alerts:      parseInt(alerts.rows[0].count),
      humanitarian: parseInt(humanitarian.rows[0].count),
      thermal_anomalies: parseInt(fires.rows[0].count),
    }
  } catch (err) {
    status.db.error = err.message
  }

  // Redis check
  try {
    await redis.ping()
    status.redis.connected = true
  } catch {
    status.redis.connected = false
  }

  res.json(status)
})

// ── Serve built frontend in production ────────────────────────────────────────
if (isProd) {
  const distPath = join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  // SPA fallback — let React Router handle all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(join(distPath, 'index.html'))
    }
  })
}

// ── Start ───────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`ThreatWatch API running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`)
  startUcdpPoller()      // boot: bulk-load GED if empty, then daily at 02:00
  startGdeltPoller()     // every 15 min — articles + tone (no map events)
  startFirmsPoller()     // every 3 hours — thermal anomalies
  startAlertsPoller()     // boot + every 6 hours — derive alerts from UCDP + FIRMS
  startReliefWebPoller()  // boot + every 6 hours — humanitarian reports
  startClassifierRunner() // boot + daily 03:00 — AI conflict classification + escalation scores
  startUnhcrPoller()      // boot + weekly Sunday 04:00 — UNHCR refugee/displacement data
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[server] Port ${PORT} is already in use.\nRun: kill $(lsof -ti:${PORT})\nThen restart.\n`)
    process.exit(1)
  } else {
    throw err
  }
})
