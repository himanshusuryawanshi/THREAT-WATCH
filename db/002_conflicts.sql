CREATE TABLE IF NOT EXISTS conflicts (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  status           TEXT DEFAULT 'pending',
  countries        TEXT[] NOT NULL,
  actors           TEXT[],
  war_start_date   DATE,
  pre_war_date     DATE,
  map_center_lat   DOUBLE PRECISION,
  map_center_lng   DOUBLE PRECISION,
  map_zoom         INTEGER DEFAULT 5,
  context          TEXT,
  confidence       DOUBLE PRECISION,
  classifier_raw   JSONB,
  event_count      INTEGER DEFAULT 0,
  fatality_count   INTEGER DEFAULT 0,
  last_event_date  DATE,
  escalation_score DOUBLE PRECISION DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK to events after conflicts table exists
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_conflict_fk,
  ADD CONSTRAINT events_conflict_fk
    FOREIGN KEY (conflict_id) REFERENCES conflicts(id) ON DELETE SET NULL;
