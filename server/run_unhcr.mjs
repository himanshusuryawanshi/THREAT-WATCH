// Standalone runner — UNHCR displacement ingest
import { ingestUnhcr } from './services/unhcrService.js'
import pool from './db.js'

console.log('[run-unhcr] Starting...')
try {
  const count = await ingestUnhcr()
  console.log(`[run-unhcr] Done — ${count} rows inserted`)
} catch (err) {
  console.error('[run-unhcr] Error:', err.message)
} finally {
  await pool.end()
  process.exit(0)
}
