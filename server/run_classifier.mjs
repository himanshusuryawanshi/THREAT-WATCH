// Standalone runner — Claude AI classifier + rule-based fallback
import { runClassifier, runRuleBasedScoring } from './services/classifierService.js'
import pool from './db.js'

console.log('[run-classifier] Starting...')
try {
  const result = await runClassifier()
  console.log('[run-classifier] Result:', JSON.stringify(result))
} catch (err) {
  console.error('[run-classifier] Error:', err.message)
  // Fallback to rule-based
  try {
    const result = await runRuleBasedScoring()
    console.log('[run-classifier] Rule-based fallback result:', JSON.stringify(result))
  } catch (err2) {
    console.error('[run-classifier] Rule-based fallback failed:', err2.message)
  }
} finally {
  await pool.end()
  process.exit(0)
}
