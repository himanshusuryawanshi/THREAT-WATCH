import cron from 'node-cron'
import { ingestLatestGDELT } from '../services/gdeltService.js'

export function startGdeltPoller() {
  console.log('[gdelt-poller] starting — articles only (no map events)')

  // Run immediately on boot
  ingestLatestGDELT().catch(err => {
    console.error('[gdelt-poller] initial ingest failed:', err.message)
  })

  // Every 15 minutes, matching GDELT update frequency
  cron.schedule('*/15 * * * *', async () => {
    try {
      const { articles } = await ingestLatestGDELT()
      console.log(`[gdelt-poller] done: +${articles} articles`)
    } catch (err) {
      console.error('[gdelt-poller] error:', err.message)
    }
  })
}
