-- ── STATEMENTS ────────────────────────────────────────────────
-- Diplomatic statements from heads of state, sourced from GDELT/news
CREATE TABLE IF NOT EXISTS statements (
  id           SERIAL PRIMARY KEY,
  conflict_id  TEXT REFERENCES conflicts(id) ON DELETE SET NULL,
  date         DATE NOT NULL,
  actor        TEXT NOT NULL,         -- 'Donald Trump', 'Ali Khamenei'
  actor_role   TEXT,                  -- 'US President', 'Supreme Leader'
  actor_country TEXT,                 -- 'USA', 'Iran'
  quote        TEXT NOT NULL,
  sentiment    TEXT DEFAULT 'neutral',-- escalatory | conciliatory | neutral
  source_url   TEXT,
  source_name  TEXT,                  -- 'Reuters', 'GDELT', 'ICG'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── SPIKE ALERTS ───────────────────────────────────────────────
-- Auto-detected escalation spikes, pending human review
CREATE TABLE IF NOT EXISTS spike_alerts (
  id              SERIAL PRIMARY KEY,
  country         TEXT NOT NULL,
  week_start      DATE NOT NULL,
  event_count     INTEGER NOT NULL,
  prev_avg        DOUBLE PRECISION,
  spike_pct       DOUBLE PRECISION,   -- e.g. 340 for 340%
  fatality_count  INTEGER DEFAULT 0,
  top_actors      TEXT[],
  top_types       TEXT[],
  status          TEXT DEFAULT 'pending', -- pending | reviewed | dismissed
  conflict_id     TEXT REFERENCES conflicts(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ
);