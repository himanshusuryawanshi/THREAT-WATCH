import cron from 'node-cron'
import { generateAlerts } from '../services/alertsService.js'

export function startAlertsPoller() {
  console.log('[alerts-poller] starting — generating initial alerts...')

  // Delay 15s on boot — alerts derive from events/conflicts already in DB, no rush
  setTimeout(() => {
    generateAlerts().catch(err =>
      console.error('[alerts-poller] initial generation failed:', err.message)
    )
  }, 15000)

  // Refresh every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[alerts-poller] refreshing alerts...')
    try {
      const { generated } = await generateAlerts()
      console.log(`[alerts-poller] done: ${generated} alerts generated`)
    } catch (err) {
      console.error('[alerts-poller] error:', err.message)
    }
  })
}
