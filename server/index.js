import express        from 'express'
import cors           from 'cors'
import dotenv         from 'dotenv'
import eventsRouter   from './routes/events.js'
// import conflictsRouter from './routes/conflicts.js'
// import adminRouter    from './routes/admin.js'
import { startScheduler } from './ingestion/scheduler.js'

dotenv.config({ path: '../.env' })

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin:  process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH'],
}))
app.use(express.json())

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/events',    eventsRouter)
// app.use('/api/conflicts', conflictsRouter)
// app.use('/api/admin',     adminRouter)

// ── Health ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ThreatWatch API running on http://localhost:${PORT}`)
  // Start ingestion pipeline — runs immediately then every 6h
//   startScheduler()
})

// Temporary test — remove after confirming
// import pool from './db/pool.js'
// pool.query('SELECT COUNT(*) FROM events').then(r => {
//   console.log('[db test] events count:', r.rows[0].count)
// }).catch(err => {
//   console.error('[db test] failed:', err.message)
// })