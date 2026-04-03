-- ── SPATIAL INDEX — core of PostGIS performance ───────────────
CREATE INDEX IF NOT EXISTS events_geom_idx
  ON events USING GIST (geom);

-- ── TIME INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS events_date_idx
  ON events (date DESC);

CREATE INDEX IF NOT EXISTS events_country_date_idx
  ON events (country, date DESC);

CREATE INDEX IF NOT EXISTS events_type_date_idx
  ON events (type, date DESC);

-- ── ACTOR INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS events_actor_idx
  ON events (actor);

-- ── FATALITY INDEX — for casualty queries ─────────────────────
CREATE INDEX IF NOT EXISTS events_fatal_idx
  ON events (fatal DESC)
  WHERE fatal > 0;

-- ── CONFLICT INDEXES ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS conflicts_status_idx
  ON conflicts (status);

CREATE INDEX IF NOT EXISTS conflicts_countries_idx
  ON conflicts USING GIN (countries);

-- ── SPIKE ALERTS INDEX ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS spikes_status_idx
  ON spike_alerts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS spikes_country_idx
  ON spike_alerts (country, week_start DESC);

-- ── STATEMENTS INDEX ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS statements_conflict_idx
  ON statements (conflict_id, date DESC);

CREATE INDEX IF NOT EXISTS statements_date_idx
  ON statements (date DESC);

-- ── WEEKLY EVENTS VIEW — used by spike detector ────────────────
CREATE OR REPLACE VIEW weekly_events AS
SELECT
  country,
  date_trunc('week', date)::DATE AS week_start,
  COUNT(*)                        AS event_count,
  SUM(fatal)                      AS fatality_count,
  array_agg(DISTINCT actor)       AS actors,
  array_agg(DISTINCT type)        AS types
FROM events
GROUP BY country, date_trunc('week', date);