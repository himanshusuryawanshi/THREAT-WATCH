import cron from 'node-cron'
import { ingestFIRMS } from '../services/firmsService.js'

export function startFirmsPoller() {
  console.log('[firms-poller] starting — every 3 hours (satellite pass frequency)')

  // Run immediately on boot
  ingestFIRMS().catch(err => {
    console.error('[firms-poller] initial ingest failed:', err.message)
  })

  // Every 3 hours — FIRMS NRT data updates within 3h of satellite overpass
  cron.schedule('0 */3 * * *', async () => {
    console.log('[firms-poller] 3h tick — ingesting thermal anomalies...')
    try {
      const { inserted, fires, conflictFires } = await ingestFIRMS()
      console.log(`[firms-poller] done: ${fires} fires fetched, +${inserted} new, ${conflictFires} in conflict zones`)
    } catch (err) {
      console.error('[firms-poller] error:', err.message)
    }
  })
}
