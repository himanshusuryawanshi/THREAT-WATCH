CREATE TABLE IF NOT EXISTS actors (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  aliases       TEXT[],
  type          TEXT NOT NULL,
  country       TEXT,
  wikidata_id   TEXT,
  wikipedia_url TEXT,
  description   TEXT,
  birth_date    DATE,
  death_date    DATE,
  image_url     TEXT,
  properties    JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actors_type ON actors(type);
CREATE INDEX IF NOT EXISTS idx_actors_country ON actors(country);
CREATE INDEX IF NOT EXISTS idx_actors_wikidata ON actors(wikidata_id);
