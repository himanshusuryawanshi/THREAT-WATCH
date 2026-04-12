import cron from 'node-cron'
import { ingestUCDP } from '../services/ucdpService.js'

export function startUcdpPoller() {
  console.log('[ucdp-poller] starting')

  // Run immediately on boot (bulk loads GED if empty, else candidate only)
  ingestUCDP().catch(err => {
    console.error('[ucdp-poller] initial ingest failed:', err.message)
  })

  // Then every 24 hours for candidate event updates
  cron.schedule('0 2 * * *', async () => {
    console.log('[ucdp-poller] 24h tick — ingesting candidate events...')
    try {
      const { eventsInserted, conflictsInserted } = await ingestUCDP()
      console.log(`[ucdp-poller] done: +${eventsInserted} events, +${conflictsInserted} conflicts`)
    } catch (err) {
      console.error('[ucdp-poller] error:', err.message)
    }
  })
}
