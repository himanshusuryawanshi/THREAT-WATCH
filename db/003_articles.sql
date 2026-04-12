CREATE TABLE IF NOT EXISTS articles (
  id              SERIAL PRIMARY KEY,
  gdelt_url       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  source_name     TEXT,
  source_country  TEXT,
  language        TEXT DEFAULT 'en',
  published_at    TIMESTAMPTZ,
  tone            DOUBLE PRECISION,
  themes          TEXT[],
  locations       JSONB,
  persons         TEXT[],
  organizations   TEXT[],
  image_url       TEXT,
  conflict_id     TEXT REFERENCES conflicts(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_conflict ON articles(conflict_id);
CREATE INDEX IF NOT EXISTS idx_articles_themes ON articles USING GIN(themes);
