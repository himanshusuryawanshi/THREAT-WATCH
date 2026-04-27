/**
 * ReliefWeb Poller — runs every 6 hours
 *
 * Fetches the latest armed-conflict humanitarian reports and upserts them
 * into the `humanitarian` table so CountryPage and sidebar panels have
 * real displacement / people-affected figures.
 */

import cron from 'node-cron'
import { ingestReliefWeb } from '../services/reliefwebService.js'

export function startReliefWebPoller() {
  // Run immediately on boot, then every 6 hours
  ingestReliefWeb().catch(err =>
    console.error('[reliefweb-poller] boot ingest failed:', err.message)
  )

  // 06:00, 12:00, 18:00, 00:00 UTC
  cron.schedule('0 0,6,12,18 * * *', async () => {
    console.log('[reliefweb-poller] scheduled ingest starting...')
    await ingestReliefWeb().catch(err =>
      console.error('[reliefweb-poller] scheduled ingest failed:', err.message)
    )
  })

  console.log('[reliefweb-poller] started — runs every 6 hours')
}
