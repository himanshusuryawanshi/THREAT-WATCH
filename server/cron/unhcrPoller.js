/**
 * UNHCR Poller — runs weekly (UNHCR data updates weekly)
 *
 * Fetches bilateral refugee displacement data for top origin/asylum
 * country pairs and upserts into the displacement table.
 */
import cron from 'node-cron'
import { ingestUnhcr } from '../services/unhcrService.js'

export function startUnhcrPoller() {
  // Run immediately on boot
  ingestUnhcr().catch(err =>
    console.error('[unhcr-poller] boot ingest failed:', err.message)
  )

  // Weekly: every Sunday at 04:00 UTC
  cron.schedule('0 4 * * 0', async () => {
    console.log('[unhcr-poller] weekly ingest starting...')
    await ingestUnhcr().catch(err =>
      console.error('[unhcr-poller] weekly ingest failed:', err.message)
    )
  })

  console.log('[unhcr-poller] started — runs weekly Sunday 04:00 UTC')
}
