import pool from '../db.js'

/**
 * generateAlerts — derives early-warning alerts from UCDP + FIRMS data.
 *
 * Logic:
 *   1. Find the most recent 30-day window in UCDP data (anchored to MAX(date))
 *   2. For each country in that window, compute event count + fatalities
 *   3. Classify as critical / elevated / watch by threshold
 *   4. Also create alerts for high-FRP FIRMS fire clusters
 *   5. Upsert into alerts table (clear stale auto-generated alerts first)
 */
export async function generateAlerts() {
  const client = await pool.connect()
  try {
    // ── 1. Determine the last 30 days of UCDP data ─────────────────────────────
    const { rows: [{ maxDate }] } = await client.query(
      `SELECT MAX(date) AS "maxDate" FROM events WHERE source = 'UCDP'`
    )
    if (!maxDate) { console.log('[alerts] no UCDP data — skipping'); return }

    const windowStart = new Date(maxDate)
    windowStart.setDate(windowStart.getDate() - 30)
    const from = windowStart.toISOString().split('T')[0]

    // ── 2. Country aggregations in window ──────────────────────────────────────
    const { rows: countryStats } = await client.query(`
      SELECT
        country,
        COUNT(*)                         AS event_count,
        COALESCE(SUM(fatalities), 0)     AS fatalities,
        MAX(date)                        AS latest_date,
        array_agg(DISTINCT type)         AS types
      FROM events
      WHERE source = 'UCDP'
        AND date BETWEEN $1 AND $2
        AND country IS NOT NULL
      GROUP BY country
      ORDER BY fatalities DESC
    `, [from, maxDate])

    // ── 3. FIRMS fire cluster counts ───────────────────────────────────────────
    // Join to events via nearest_event_id to get country
    const { rows: fireStats } = await client.query(`
      SELECT
        e.country,
        COUNT(t.id)        AS fire_count,
        MAX(t.frp)         AS max_frp,
        AVG(t.frp)         AS avg_frp
      FROM thermal_anomalies t
      JOIN events e ON e.id = t.nearest_event_id
      WHERE t.in_conflict_zone = TRUE
        AND t.acq_date >= NOW() - INTERVAL '7 days'
        AND e.country IS NOT NULL
      GROUP BY e.country
      HAVING COUNT(t.id) >= 50
      ORDER BY fire_count DESC
      LIMIT 10
    `)

    // ── 4. Clear stale auto-generated alerts ──────────────────────────────────
    await client.query(
      `DELETE FROM alerts WHERE alert_type IN ('conflict_escalation', 'fire_cluster', 'mass_casualty')`
    )

    const inserts = []

    // ── 5. Conflict escalation alerts ─────────────────────────────────────────
    for (const row of countryStats) {
      const events     = parseInt(row.event_count)
      const fatalities = parseInt(row.fatalities)

      let severity = null

      if (fatalities >= 200 || events >= 80) {
        severity = 'critical'
      } else if (fatalities >= 50 || events >= 30) {
        severity = 'elevated'
      } else if (fatalities >= 20 || events >= 15) {
        severity = 'watch'
      }

      if (!severity) continue

      const types = (row.types || []).join(', ')
      inserts.push({
        alert_type:  'conflict_escalation',
        severity,
        country:     row.country,
        title:       `${row.country}: ${events} events, ${fatalities} fatalities (30d)`,
        description: `Elevated conflict activity in ${row.country} during ${from} → ${row.latest_date}. Event types: ${types}. ${fatalities} total fatalities recorded.`,
        signal_data: JSON.stringify({ event_count: events, fatalities, from, to: row.latest_date, types: row.types }),
      })
    }

    // ── 6. High-fatality single events (mass casualty alerts) ─────────────────
    const { rows: massEvents } = await client.query(`
      SELECT id, date, country, location, actor1, fatalities, type, notes
      FROM events
      WHERE source = 'UCDP'
        AND date BETWEEN $1 AND $2
        AND fatalities >= 100
      ORDER BY fatalities DESC
      LIMIT 10
    `, [from, maxDate])

    for (const ev of massEvents) {
      inserts.push({
        alert_type:  'mass_casualty',
        severity:    'critical',
        country:     ev.country,
        title:       `Mass casualty event: ${ev.fatalities} killed in ${ev.location || ev.country}`,
        description: ev.notes || `${ev.type} in ${ev.location}, ${ev.country} on ${ev.date}. Actor: ${ev.actor1}. ${ev.fatalities} fatalities.`,
        signal_data: JSON.stringify({ event_id: ev.id, fatalities: ev.fatalities, date: ev.date, location: ev.location }),
      })
    }

    // ── 7. FIRMS fire cluster alerts ──────────────────────────────────────────
    for (const row of fireStats) {
      const fires  = parseInt(row.fire_count)
      const maxFRP = parseFloat(row.max_frp).toFixed(0)
      const severity = fires >= 500 ? 'elevated' : 'watch'

      inserts.push({
        alert_type:  'fire_cluster',
        severity,
        country:     row.country,
        title:       `${row.country}: ${fires} satellite fire detections (7d)`,
        description: `NASA FIRMS detected ${fires} thermal anomalies in conflict zones within ${row.country} over the past 7 days. Peak radiative power: ${maxFRP} MW.`,
        signal_data: JSON.stringify({ fire_count: fires, max_frp: row.max_frp, avg_frp: row.avg_frp }),
      })
    }

    // ── 8. Bulk insert ────────────────────────────────────────────────────────
    if (inserts.length === 0) {
      console.log('[alerts] no thresholds triggered')
      return { generated: 0 }
    }

    for (const a of inserts) {
      await client.query(`
        INSERT INTO alerts (alert_type, severity, country, title, description, signal_data)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [a.alert_type, a.severity, a.country, a.title, a.description, a.signal_data])
    }

    console.log(`[alerts] generated ${inserts.length} alerts`)
    return { generated: inserts.length }

  } finally {
    client.release()
  }
}
