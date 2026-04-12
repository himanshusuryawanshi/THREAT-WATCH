CREATE TABLE IF NOT EXISTS humanitarian (
  id               SERIAL PRIMARY KEY,
  reliefweb_id     INTEGER UNIQUE,
  title            TEXT NOT NULL,
  country          TEXT NOT NULL,
  disaster_type    TEXT,
  status           TEXT,
  source_org       TEXT,
  summary          TEXT,
  people_affected  INTEGER,
  people_displaced INTEGER,
  url              TEXT,
  published_at     TIMESTAMPTZ,
  conflict_id      TEXT REFERENCES conflicts(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_humanitarian_country ON humanitarian(country);
CREATE INDEX IF NOT EXISTS idx_humanitarian_published ON humanitarian(published_at DESC);
