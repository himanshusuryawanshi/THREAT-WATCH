-- ── CONFLICTS ─────────────────────────────────────────────────
-- Auto-detected and human-confirmed conflicts
CREATE TABLE IF NOT EXISTS conflicts (
  id              TEXT PRIMARY KEY,        -- e.g. 'iran-israel'
  title           TEXT NOT NULL,           -- e.g. 'Iran vs Israel'
  status          TEXT DEFAULT 'pending',  -- pending | confirmed | dismissed
  countries       TEXT[] NOT NULL,         -- ['Iran','Israel','Lebanon']
  actors          TEXT[],                  -- ['IDF','IRGC','Hezbollah']
  war_start_date  DATE,                    -- editorial: when war began
  pre_war_date    DATE,                    -- background history from
  map_center_lat  DOUBLE PRECISION,
  map_center_lng  DOUBLE PRECISION,
  map_zoom        INTEGER DEFAULT 5,
  context         TEXT,                    -- brief background text
  confidence      DOUBLE PRECISION,        -- classifier confidence 0-1
  classifier_raw  JSONB,                   -- full Claude API response
  event_count     INTEGER DEFAULT 0,       -- auto-computed
  fatality_count  INTEGER DEFAULT 0,       -- auto-computed
  last_event_date DATE,                    -- auto-computed
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ,
  confirmed_by    TEXT
);

-- ── CONFLICT EVENTS junction ───────────────────────────────────
-- Links events to conflicts (one event can belong to multiple)
CREATE TABLE IF NOT EXISTS conflict_events (
  conflict_id  TEXT REFERENCES conflicts(id) ON DELETE CASCADE,
  event_id     TEXT REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (conflict_id, event_id)
);

CREATE TRIGGER conflicts_updated_at
  BEFORE UPDATE ON conflicts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();