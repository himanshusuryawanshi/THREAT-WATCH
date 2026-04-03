import pool from '../db/pool.js'

const SPIKE_THRESHOLD = 2.0   // 200% increase vs 3-month average
const MIN_EVENTS      = 5     // ignore countries with < 5 events/week (noise)
const FATALITY_WEIGHT = 0.4   // fatalities amplify the spike score

// ── Main entry point ────────────────────────────────────────────────────────
export async function runSpikeDetection() {
  console.log('[spike] running detection...')

  const spikes = await detectSpikes()

  if (!spikes.length) {
    console.log('[spike] no new spikes detected')
    return []
  }

  console.log(`[spike] ${spikes.length} spike(s) detected`)

  for (const spike of spikes) {
    await writeAlert(spike)
  }

  return spikes
}

// ── Detect which countries spiked this week ─────────────────────────────────
async function detectSpikes() {
  const result = await pool.query(`
    WITH
    latest AS (
      SELECT MAX(date) AS max_date FROM events
    ),
    this_week AS (
      SELECT
        country,
        COUNT(*)                    AS week_events,
        COALESCE(SUM(fatal), 0)     AS week_fatal,
        array_agg(DISTINCT actor)   AS actors,
        array_agg(DISTINCT type)    AS types
      FROM events, latest
      WHERE date >= latest.max_date - INTERVAL '7 days'
      GROUP BY country
    ),
    baseline AS (
      SELECT
        country,
        COUNT(*) / 13.0             AS avg_weekly_events
      FROM events, latest
      WHERE date >= latest.max_date - INTERVAL '90 days'
        AND date <  latest.max_date - INTERVAL '7 days'
      GROUP BY country
    )
    SELECT
      t.country,
      t.week_events,
      t.week_fatal,
      t.actors,
      t.types,
      COALESCE(b.avg_weekly_events, 0)  AS avg_weekly,
      CASE
        WHEN COALESCE(b.avg_weekly_events, 0) = 0 THEN 999
        ELSE ROUND(
          ((t.week_events - b.avg_weekly_events) / b.avg_weekly_events)::numeric
          * (1 + $1::numeric * t.week_fatal / GREATEST(t.week_events, 1))
        , 2)
      END                               AS spike_score
    FROM      this_week t
    LEFT JOIN baseline  b USING (country)
    WHERE t.week_events >= $2
    ORDER BY spike_score DESC
  `, [FATALITY_WEIGHT.toString(), MIN_EVENTS])

  return result.rows
    .filter(r => r.spike_score >= SPIKE_THRESHOLD)
    .map(r => ({
      country:    r.country,
      weekEvents: parseInt(r.week_events),
      weekFatal:  parseInt(r.week_fatal),
      actors:     r.actors?.slice(0, 5) ?? [],
      types:      [...new Set(r.types ?? [])],
      avgWeekly:  parseFloat(r.avg_weekly),
      spikeScore: parseFloat(r.spike_score),
      spikePct:   r.avg_weekly > 0
        ? Math.round(((r.week_events - r.avg_weekly) / r.avg_weekly) * 100)
        : null,
    }))
}

// ── Write spike alerts to Postgres (matches actual schema) ──────────────────
async function writeAlert(spike) {
  const { rows } = await pool.query(`SELECT MAX(date) AS max_date FROM events`)
  const maxDate = new Date(rows[0].max_date)
  maxDate.setDate(maxDate.getDate() - 7)
  const weekStartDate = maxDate.toISOString().split('T')[0]

  await pool.query(`
    INSERT INTO spike_alerts (
      country, week_start, event_count, prev_avg,
      spike_pct, fatality_count, top_actors, top_types, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    ON CONFLICT (country, week_start) DO UPDATE SET
      event_count    = EXCLUDED.event_count,
      spike_pct      = EXCLUDED.spike_pct,
      fatality_count = EXCLUDED.fatality_count,
      top_actors     = EXCLUDED.top_actors
  `, [
    spike.country,
    weekStartDate,
    spike.weekEvents,
    spike.avgWeekly,
    spike.spikePct,
    spike.weekFatal,
    spike.actors,
    spike.types,
  ])
}

// ── Query recent alerts (used by admin panel + API) ──────────────────────────
export async function getRecentAlerts({ days = 30 } = {}) {
  const result = await pool.query(`
    SELECT
      id, country, week_start, event_count,
      ROUND(prev_avg::numeric, 1) AS prev_avg,
      spike_pct, fatality_count,
      top_actors, top_types, status, created_at
    FROM spike_alerts
    WHERE created_at >= NOW() - ($1 || ' days')::interval
    ORDER BY created_at DESC, spike_pct DESC
  `, [days])

  return result.rows
}