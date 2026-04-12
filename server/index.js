import express         from 'express'
import cors            from 'cors'
import dotenv          from 'dotenv'
import eventsRouter    from './routes/events.js'
import contextRouter   from './routes/context.js'
import firesRouter     from './routes/fires.js'
import conflictsRouter from './routes/conflicts.js'
import geoRouter       from './routes/geo.js'
import alertsRouter    from './routes/alerts.js'
import { startGdeltPoller  } from './cron/gdeltPoller.js'
import { startUcdpPoller   } from './cron/ucdpPoller.js'
import { startFirmsPoller  } from './cron/firmsPoller.js'
import { startAlertsPoller } from './cron/alertsPoller.js'

dotenv.config({ path: '../.env' })

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin:  process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH'],
}))
app.use(express.json())

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
// TODO: app.use('/api/displacement', displacementRouter)  — UNHCR refugee flows
// TODO: app.use('/api/tone',         toneRouter)          — GDELT tone analytics

// ── Phase 3 additions ─────────────────────────────────────────────────────────
// TODO: app.use('/api/risk',     riskRouter)          — ThreatWatch risk scores
// TODO: app.use('/api/briefing', briefingRouter)      — Claude AI daily briefings

// ── Phase 4 additions ─────────────────────────────────────────────────────────
// TODO: app.use('/api/sanctions', sanctionsRouter)    — OpenSanctions data

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── Start ───────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ThreatWatch API running on http://localhost:${PORT}`)
  startUcdpPoller()    // boot: bulk-load GED if empty, then daily at 02:00
  startGdeltPoller()   // every 15 min — articles + tone (no map events)
  startFirmsPoller()   // every 3 hours — thermal anomalies
  startAlertsPoller()  // boot + every 6 hours — derive alerts from UCDP + FIRMS
})
