import cron from 'node-cron'
import { ingestUCDP, fetchCandidateEvents, getLatestCandidateVersion } from '../services/ucdpService.js'

export function startUcdpPoller() {
  console.log('[ucdp-poller] starting')

  // Boot: full ingest (bulk GED if empty, then candidate)
  ingestUCDP().catch(err => {
    console.error('[ucdp-poller] initial ingest failed:', err.message)
  })

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
