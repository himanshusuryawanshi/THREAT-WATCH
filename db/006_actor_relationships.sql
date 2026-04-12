CREATE TABLE IF NOT EXISTS actor_relationships (
  id           SERIAL PRIMARY KEY,
  actor1_id    TEXT REFERENCES actors(id) ON DELETE CASCADE,
  actor2_id    TEXT REFERENCES actors(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  start_date   DATE,
  end_date     DATE,
  source       TEXT,
  confidence   DOUBLE PRECISION DEFAULT 1.0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actor_rel_actor1 ON actor_relationships(actor1_id);
CREATE INDEX IF NOT EXISTS idx_actor_rel_actor2 ON actor_relationships(actor2_id);
