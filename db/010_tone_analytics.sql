-- GDELT tone analytics — aggregated per entity per day
-- Drives early warning (tone drops precede violence 48-72h), sidebar panels,
-- country intelligence pages, and actor sentiment tracking.
-- Populated by toneAggregator cron (daily). NOT raw events — NEVER used for map dots.
CREATE TABLE IF NOT EXISTS tone_analytics (
  id               SERIAL PRIMARY KEY,
  entity           TEXT NOT NULL,              -- country name, actor name, or conflict_id
  entity_type      TEXT NOT NULL,              -- 'country', 'actor', 'conflict'
  date             DATE NOT NULL,
  avg_tone         DOUBLE PRECISION,           -- GDELT tone scale (-100 to +100)
  article_count    INTEGER DEFAULT 0,
  tone_std_dev     DOUBLE PRECISION,
  source_countries JSONB,                      -- { "US": -3.2, "RU": 1.4, "CN": -0.8 }
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity, entity_type, date)
);

CREATE INDEX IF NOT EXISTS idx_tone_entity ON tone_analytics(entity, entity_type);
CREATE INDEX IF NOT EXISTS idx_tone_date   ON tone_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_tone_type   ON tone_analytics(entity_type);
