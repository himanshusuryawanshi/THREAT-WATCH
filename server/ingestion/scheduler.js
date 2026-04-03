import cron from 'node-cron'
import { ingestLatestGDELT } from './gdelt.js'
import { runSpikeDetection }  from '../detection/spikeDetector.js'

export function startScheduler() {
  console.log('[scheduler] starting...')

  // Ingest immediately on boot
  ingestLatestGDELT()

  // Then every 15 minutes — matches GDELT update frequency
  cron.schedule('*/15 * * * *', async () => {
    console.log('[scheduler] 15min tick — ingesting GDELT...')
    await ingestLatestGDELT()
  })

  // Spike detection every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[scheduler] 6h tick — running spike detection...')
    await runSpikeDetection()
  })

  console.log('[scheduler] running — GDELT every 15min, spikes every 6h')
}