-- UNHCR displacement data
-- Refugee flows origin → asylum country, updated weekly
CREATE TABLE IF NOT EXISTS displacement (
  id              SERIAL PRIMARY KEY,
  year            INTEGER NOT NULL,
  country_origin  TEXT NOT NULL,
  country_asylum  TEXT NOT NULL,
  iso_origin      TEXT,
  iso_asylum      TEXT,
  refugees        INTEGER DEFAULT 0,
  asylum_seekers  INTEGER DEFAULT 0,
  idps            INTEGER DEFAULT 0,
  stateless       INTEGER DEFAULT 0,
  returned        INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, country_origin, country_asylum)
);

CREATE INDEX IF NOT EXISTS idx_displacement_origin ON displacement(country_origin);
CREATE INDEX IF NOT EXISTS idx_displacement_asylum ON displacement(country_asylum);
CREATE INDEX IF NOT EXISTS idx_displacement_year   ON displacement(year DESC);
CREATE INDEX IF NOT EXISTS idx_displacement_iso_o  ON displacement(iso_origin);
CREATE INDEX IF NOT EXISTS idx_displacement_iso_a  ON displacement(iso_asylum);
