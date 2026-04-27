/**
 * classifierService — Claude AI conflict classifier
 *
 * Groups UCDP events from the last 30 days by country + actor pair.
 * For clusters with 10+ events, calls Claude API to produce:
 *   - A human-readable conflict title
 *   - A 2-3 sentence intelligence context summary
 *   - An escalation_score (0.0–1.0)
 *
 * Gracefully skips if ANTHROPIC_API_KEY is not set or the API call fails.
 * Updates the conflicts table and flushes related caches.
 *
 * Usage:
 *   import { runClassifier } from './classifierService.js'
 *   await runClassifier()
 */

import pool from '../db.js'
import { flushPattern } from '../cache.js'

const MIN_CLUSTER_EVENTS = 10
const CLAUDE_MODEL       = 'claude-haiku-4-5-20251001' // fast + cheap for bulk classification
const BATCH_SIZE         = 5   // concurrent API calls

// ── Claude API call ───────────────────────────────────────────────────────────
async function classifyCluster(cluster) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const prompt = `You are an intelligence analyst. Based on the following conflict event cluster, provide a structured assessment.

Conflict cluster:
- Country: ${cluster.country}
- Primary actor: ${cluster.actor1}
- Opposing actor: ${cluster.actor2 || 'Unknown'}
- Events (last 30 days): ${cluster.event_count}
- Total fatalities (last 30 days): ${cluster.fatalities}
- Event types observed: ${cluster.types.join(', ')}
- Sample event: ${cluster.sample_note || 'No details available'}

Return a JSON object with exactly these fields:
{
  "title": "Brief conflict title (e.g. 'Myanmar Civil War – Shan State')",
  "context": "2-3 sentence intelligence summary covering what is happening, who is involved, and current trajectory.",
  "escalation_score": 0.0
}

The escalation_score is 0.0–1.0 where:
  0.0–0.1 = stable/dormant
  0.1–0.3 = watch (low-level activity)
  0.3–0.7 = elevated (active conflict)
  0.7–1.0 = critical (major escalation, high fatalities)

Base the score on: event frequency, fatality count, event types (battles/explosions score higher than protests), and 30-day trend.

Respond ONLY with the JSON object, no other text.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 400,
        messages:   [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.warn(`[classifier] API error ${response.status}: ${errText.slice(0, 100)}`)
      return null
    }

    const data = await response.json()
    const raw  = data.content?.[0]?.text?.trim()
    if (!raw) return null

    // Strip markdown code fences if present
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    return JSON.parse(clean)
  } catch (err) {
    console.warn(`[classifier] call failed for ${cluster.country}/${cluster.actor1}: ${err.message}`)
    return null
  }
}

// ── Process a batch of clusters ───────────────────────────────────────────────
async function processBatch(clusters, client) {
  // Run API calls in parallel (BATCH_SIZE at a time)
  const results = await Promise.all(
    clusters.map(async cluster => {
      const classification = await classifyCluster(cluster)
      return { cluster, classification }
    })
  )

  let updated = 0
  for (const { cluster, classification } of results) {
    if (!classification) continue

    // Find matching conflict(s) — match by country membership
    const { rows: matches } = await client.query(`
      SELECT id FROM conflicts
      WHERE $1 = ANY(countries)
        AND ($2 = ANY(actors) OR $3 = ANY(actors) OR array_length(actors, 1) = 0)
      LIMIT 1
    `, [cluster.country, cluster.actor1, cluster.actor2 || ''])

    if (matches.length === 0) {
      // No existing conflict record — upsert a new one
      const newId = `classifier_${cluster.country.toLowerCase().replace(/\s+/g, '_')}_${cluster.actor1.toLowerCase().replace(/\s+/g, '_').slice(0, 20)}`
      await client.query(`
        INSERT INTO conflicts (id, title, status, countries, actors, context, context_summary, escalation_score, classifier_version, confidence)
        VALUES ($1, $2, 'active', ARRAY[$3]::TEXT[], ARRAY[$4, $5]::TEXT[], $6, $7, $8, $9, 0.6)
        ON CONFLICT (id) DO UPDATE
          SET title              = EXCLUDED.title,
              context            = EXCLUDED.context,
              context_summary    = EXCLUDED.context_summary,
              escalation_score   = EXCLUDED.escalation_score,
              classifier_version = EXCLUDED.classifier_version,
              updated_at         = NOW()
      `, [
        newId,
        classification.title,
        cluster.country,
        cluster.actor1,
        cluster.actor2 || '',
        classification.context,
        classification.context,
        Math.min(1.0, Math.max(0.0, parseFloat(classification.escalation_score) || 0.3)),
        'claude-haiku-v1',
      ])
    } else {
      // Update existing conflict record
      await client.query(`
        UPDATE conflicts
        SET title              = $2,
            context            = $3,
            context_summary    = $4,
            escalation_score   = $5,
            classifier_version = $6,
            updated_at         = NOW()
        WHERE id = $1
      `, [
        matches[0].id,
        classification.title,
        classification.context,
        classification.context,
        Math.min(1.0, Math.max(0.0, parseFloat(classification.escalation_score) || 0.3)),
        'claude-haiku-v1',
      ])
    }
    updated++
  }
  return updated
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function runClassifier() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[classifier] ANTHROPIC_API_KEY not set — computing rule-based escalation scores only')
    return runRuleBasedScoring()
  }

  console.log('[classifier] Starting Claude AI classification...')
  const client = await pool.connect()
  let totalUpdated = 0

  try {
    // ── 1. Get last 30 days anchor ─────────────────────────────────────────
    const { rows: [{ maxDate }] } = await client.query(
      `SELECT MAX(date) AS "maxDate" FROM events WHERE source IN ('UCDP', 'UCDP_CANDIDATE')`
    )
    if (!maxDate) {
      console.log('[classifier] no UCDP events — skipping')
      return { updated: 0 }
    }

    const windowStart = new Date(maxDate)
    windowStart.setDate(windowStart.getDate() - 30)
    const from = windowStart.toISOString().split('T')[0]

    // ── 2. Cluster events by country + actor pair ──────────────────────────
    const { rows: clusters } = await client.query(`
      SELECT
        country,
        COALESCE(actor1, 'Unknown') AS actor1,
        COALESCE(actor2, 'Unknown') AS actor2,
        COUNT(*)                     AS event_count,
        COALESCE(SUM(fatalities), 0) AS fatalities,
        array_agg(DISTINCT type)     AS types,
        (array_agg(notes ORDER BY fatalities DESC NULLS LAST))[1] AS sample_note
      FROM events
      WHERE source IN ('UCDP', 'UCDP_CANDIDATE')
        AND date BETWEEN $1 AND $2
        AND country IS NOT NULL
        AND actor1 IS NOT NULL AND actor1 != ''
      GROUP BY country, COALESCE(actor1, 'Unknown'), COALESCE(actor2, 'Unknown')
      HAVING COUNT(*) >= $3
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `, [from, maxDate, MIN_CLUSTER_EVENTS])

    console.log(`[classifier] ${clusters.length} clusters qualify (≥${MIN_CLUSTER_EVENTS} events) — classifying...`)

    // ── 3. Process in batches ──────────────────────────────────────────────
    for (let i = 0; i < clusters.length; i += BATCH_SIZE) {
      const batch = clusters.slice(i, i + BATCH_SIZE)
      await client.query('BEGIN')
      try {
        const n = await processBatch(batch, client)
        await client.query('COMMIT')
        totalUpdated += n
        console.log(`[classifier] batch ${Math.floor(i / BATCH_SIZE) + 1}: updated ${n} conflicts`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`[classifier] batch error: ${err.message}`)
      }
    }

    // ── 4. Flush conflicts cache ───────────────────────────────────────────
    await flushPattern('conflicts:*')

    console.log(`[classifier] Done — ${totalUpdated} conflict records enriched with AI context`)
    return { updated: totalUpdated, clusters: clusters.length }

  } finally {
    client.release()
  }
}

// ── Rule-based fallback: compute escalation scores without Claude API ──────────
export async function runRuleBasedScoring() {
  console.log('[classifier] running rule-based escalation scoring...')
  const client = await pool.connect()
  let updated = 0

  try {
    // Get last 30-day window
    const { rows: [{ maxDate }] } = await client.query(
      `SELECT MAX(date) AS "maxDate" FROM events WHERE source IN ('UCDP', 'UCDP_CANDIDATE')`
    )
    if (!maxDate) return { updated: 0 }

    const windowStart = new Date(maxDate)
    windowStart.setDate(windowStart.getDate() - 30)
    const from = windowStart.toISOString().split('T')[0]

    // Cluster events by country+actor for context generation
    const { rows: clusters } = await client.query(`
      SELECT
        country,
        COALESCE(actor1, 'Unknown') AS actor1,
        COALESCE(actor2, 'Unknown') AS actor2,
        COUNT(*)                     AS event_count,
        COALESCE(SUM(fatalities), 0) AS fatalities,
        array_agg(DISTINCT type)     AS types
      FROM events
      WHERE source IN ('UCDP', 'UCDP_CANDIDATE')
        AND date BETWEEN $1 AND $2
        AND country IS NOT NULL
        AND actor1 IS NOT NULL AND actor1 != ''
      GROUP BY country, COALESCE(actor1,'Unknown'), COALESCE(actor2,'Unknown')
      HAVING COUNT(*) >= $3
      ORDER BY COUNT(*) DESC
    `, [from, maxDate, MIN_CLUSTER_EVENTS])

    // Build a lookup: country → cluster data
    const clusterMap = {}
    for (const c of clusters) {
      if (!clusterMap[c.country]) clusterMap[c.country] = c
    }

    // Update escalation_score + generate rule-based context for all active conflicts
    const { rows: activeConflicts } = await client.query(`
      SELECT id, title, countries, actors FROM conflicts
      WHERE EXISTS (
        SELECT 1 FROM events e2
        WHERE e2.country = ANY(conflicts.countries)
          AND e2.source IN ('UCDP', 'UCDP_CANDIDATE')
          AND e2.date BETWEEN $1 AND $2
      )
    `, [from, maxDate])

    for (const conf of activeConflicts) {
      const country  = conf.countries?.[0] || ''
      const cluster  = clusterMap[country]
      const events   = parseInt(cluster?.event_count || 0)
      const fatals   = parseInt(cluster?.fatalities  || 0)
      const types    = cluster?.types || []

      let score
      if (fatals >= 200 || events >= 80) score = 0.85
      else if (fatals >= 50  || events >= 30) score = 0.55
      else if (fatals >= 20  || events >= 15) score = 0.25
      else score = 0.08

      // Generate a concise rule-based context summary
      const level = score > 0.7 ? 'critical' : score > 0.3 ? 'elevated' : 'low-level'
      const typeStr = types.length > 0 ? types.slice(0, 2).join(' and ') : 'armed activity'
      const contextSummary = `${level.charAt(0).toUpperCase() + level.slice(1)} conflict activity in ${country} over the past 30 days. ` +
        `${events} events recorded (${fatals} fatalities) involving ${typeStr}. ` +
        `Actors: ${(conf.actors || []).slice(0, 2).join(' vs ') || 'multiple parties'}.`

      await client.query(`
        UPDATE conflicts
        SET escalation_score   = $2,
            context            = $3,
            context_summary    = $3,
            classifier_version = 'rule-based-v1',
            updated_at         = NOW()
        WHERE id = $1
      `, [conf.id, score, contextSummary])
      updated++
    }

    await flushPattern('conflicts:*')
    console.log(`[classifier] rule-based scoring updated ${updated} conflicts`)
    return { updated }

  } finally {
    client.release()
  }
}
