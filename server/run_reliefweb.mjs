// Standalone runner for ReliefWeb ingest
import { ingestReliefWeb } from './services/reliefwebService.js'
import pool from './db.js'

console.log('[run-reliefweb] Starting...')
try {
  const count = await ingestReliefWeb()
  console.log(`[run-reliefweb] Done — ${count} rows upserted`)
} catch (err) {
  console.error('[run-reliefweb] Error:', err.message)
} finally {
  await pool.end()
  process.exit(0)
}
