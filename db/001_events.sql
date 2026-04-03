-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ── EVENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  date          DATE NOT NULL,
  type          TEXT NOT NULL,
  subtype       TEXT,
  country       TEXT NOT NULL,
  location      TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  origin_lat    DOUBLE PRECISION,
  origin_lng    DOUBLE PRECISION,
  geom          GEOMETRY(Point, 4326),
  actor         TEXT,
  actor2        TEXT,
  fatal         INTEGER DEFAULT 0,
  notes         TEXT,
  source        TEXT DEFAULT 'ACLED',
  disorder      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();