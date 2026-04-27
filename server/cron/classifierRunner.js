/**
 * classifierRunner — runs after UCDP ingest and daily at 03:00 UTC
 *
 * Uses Claude AI if ANTHROPIC_API_KEY is set, otherwise falls back
 * to rule-based escalation scoring. Never crashes the process.
 */

import cron from 'node-cron'
import { runClassifier } from '../services/classifierService.js'

export function startClassifierRunner() {
  // Run immediately on boot
  runClassifier().catch(err =>
    console.error('[classifier-runner] boot run failed:', err.message)
  )

  // Daily at 03:00 UTC (after UCDP ingest at 02:00)
  cron.schedule('0 3 * * *', async () => {
    console.log('[classifier-runner] scheduled run starting...')
    await runClassifier().catch(err =>
      console.error('[classifier-runner] scheduled run failed:', err.message)
    )
  })

  const mode = process.env.ANTHROPIC_API_KEY ? 'Claude AI' : 'rule-based'
  console.log(`[classifier-runner] started — daily at 03:00 UTC (mode: ${mode})`)
}
