-- ── Materialized Views — Blueprint Part 4, Rule 13 ──────────────────────────
--
-- Purpose: Eliminate live GROUP BY aggregations against 400k+ row events table
-- on every API request. These views are refreshed CONCURRENTLY (UNIQUE INDEX
-- required) so read queries are never blocked during refresh.
--
-- Run: docker exec -i threatwatch_postgres psql -U threatwatch -d threatwatch < db/014_materialized_views.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Country stats — sidebar, country pages, risk scoring
--    Replaces live COUNT(*)/SUM(fatalities) GROUP BY country on every request
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_country_stats AS
SELECT
  country,
  COUNT(*)                                                       AS total_events,
  COALESCE(SUM(fatalities), 0)                                   AS total_fatalities,
  COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '7 days')      AS events_7d,
  COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '30 days')     AS events_30d,
  COALESCE(SUM(fatalities) FILTER (WHERE date >= NOW() - INTERVAL '30 days'), 0)
                                                                 AS fatalities_30d,
  COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '90 days')     AS events_90d,
  MAX(date)                                                      AS last_event_date
FROM events
WHERE source = 'UCDP'
GROUP BY country;

-- UNIQUE INDEX required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_country_stats ON mv_country_stats(country);

-- 2. Choropleth — pre-joined with geo_boundaries for instant map rendering
--    Replaces 250-polygon × 400k-event spatial join on every choropleth request
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_choropleth AS
SELECT
  g.iso_a3,
  g.name,
  COALESCE(cs.events_30d,    0) AS event_count,
  COALESCE(cs.fatalities_30d, 0) AS fatalities,
  COALESCE(cs.total_events,  0) AS total_events,
  cs.last_event_date
FROM geo_boundaries g
LEFT JOIN mv_country_stats cs ON LOWER(g.name) = LOWER(cs.country)
WHERE g.admin_level = 0
  AND g.iso_a3 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_choropleth ON mv_choropleth(iso_a3);

-- 3. Event type breakdown — sidebar donut chart
--    Replaces live GROUP BY type on events table for every sidebar load
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_event_breakdown AS
SELECT
  type,
  COUNT(*)                     AS count,
  COALESCE(SUM(fatalities), 0) AS fatalities
FROM events
WHERE source = 'UCDP'
  AND date >= NOW() - INTERVAL '30 days'
GROUP BY type;

-- No natural unique column; use type as unique key
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_event_breakdown ON mv_event_breakdown(type);

-- 4. Top countries — sidebar bar chart, top-20 by event count (30 days)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_countries AS
SELECT
  country,
  COUNT(*)                     AS events,
  COALESCE(SUM(fatalities), 0) AS fatalities,
  MAX(date)                    AS last_event
FROM events
WHERE source = 'UCDP'
  AND date >= NOW() - INTERVAL '30 days'
GROUP BY country
ORDER BY events DESC
LIMIT 20;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_countries ON mv_top_countries(country);

-- 5. FIRMS conflict zone summary — sidebar satellite section
--    Aggregates thermal anomalies by country for the SatelliteFiresPanel
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_firms_conflict_summary AS
SELECT
  e.country,
  COUNT(ta.id)                 AS fire_count,
  ROUND(AVG(ta.frp)::NUMERIC, 1) AS avg_frp,
  MAX(ta.frp)                  AS max_frp,
  MAX(ta.acq_date)             AS latest_fire
FROM thermal_anomalies ta
JOIN events e ON ta.nearest_event_id = e.id
WHERE ta.in_conflict_zone = TRUE
  AND ta.acq_date >= NOW() - INTERVAL '7 days'
GROUP BY e.country
ORDER BY fire_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_firms_conflict_summary ON mv_firms_conflict_summary(country);

-- ── Initial population ────────────────────────────────────────────────────────
-- Run a non-CONCURRENT refresh on first creation (CONCURRENT needs existing data)
REFRESH MATERIALIZED VIEW mv_country_stats;
REFRESH MATERIALIZED VIEW mv_choropleth;
REFRESH MATERIALIZED VIEW mv_event_breakdown;
REFRESH MATERIALIZED VIEW mv_top_countries;
REFRESH MATERIALIZED VIEW mv_firms_conflict_summary;
