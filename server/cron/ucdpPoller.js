import cron from 'node-cron'
import pool from '../db.js'
import { ingestUCDP, fetchCandidateEvents, getLatestCandidateVersion } from '../services/ucdpService.js'

// Skip boot ingest if data was ingested within this window (2 hours)
const SKIP_IF_INGESTED_WITHIN_MS = 2 * 60 * 60 * 1000

async function wasRecentlyIngested() {
  try {
    const r = await pool.query(`
      SELECT MAX(created_at) AS last_ingest FROM events
      WHERE source IN ('UCDP', 'UCDP_CANDIDATE')
    `)
    const last = r.rows[0]?.last_ingest
    if (!last) return false
    return (Date.now() - new Date(last).getTime()) < SKIP_IF_INGESTED_WITHIN_MS
  } catch {
    return false
  }
}

export function startUcdpPoller() {
  console.log('[ucdp-poller] starting')

  // Boot ingest — delayed 5s so the server is ready before heavy DB work starts.
  // Skipped if data was ingested within the last 2 hours (e.g. rapid restarts).
  setTimeout(async () => {
    const recent = await wasRecentlyIngested()
    if (recent) {
      console.log('[ucdp-poller] data ingested recently — skipping boot ingest')
      return
    }
    ingestUCDP().catch(err =>
      console.error('[ucdp-poller] initial ingest failed:', err.message)
    )
  }, 5000)

  // Daily at 02:00 — check for new monthly candidate release
  cron.schedule('0 2 * * *', async () => {
    console.log('[ucdp-poller] 24h tick — checking for new candidate release...')
    try {
      const latest = await getLatestCandidateVersion()
      console.log(`[ucdp-poller] latest candidate version: ${latest}`)
      const inserted = await fetchCandidateEvents()
      console.log(`[ucdp-poller] candidate refresh done: +${inserted} events`)
    } catch (err) {
      console.error('[ucdp-poller] error:', err.message)
    }
  })
}
