CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  source          TEXT NOT NULL,
  source_id       TEXT,
  date            DATE NOT NULL,
  type            TEXT NOT NULL,
  subtype         TEXT,
  country         TEXT NOT NULL,
  admin1          TEXT,
  location        TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  origin_lat      DOUBLE PRECISION,
  origin_lng      DOUBLE PRECISION,
  geom            GEOMETRY(Point, 4326),
  geo_precision   INTEGER DEFAULT 0,
  actor1          TEXT,
  actor2          TEXT,
  fatalities      INTEGER DEFAULT 0,
  fatalities_low  INTEGER,
  fatalities_high INTEGER,
  notes           TEXT,
  url             TEXT,
  tone            DOUBLE PRECISION,
  goldstein       DOUBLE PRECISION,
  conflict_id     TEXT,
  disorder        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date DESC);
CREATE INDEX IF NOT EXISTS idx_events_country ON events(country);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_conflict ON events(conflict_id);
CREATE INDEX IF NOT EXISTS idx_events_geom ON events USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_events_geo_precision ON events(geo_precision);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_dedup ON events(source, source_id);

-- Auto-compute geom from lat/lng and update timestamp
CREATE OR REPLACE FUNCTION compute_geom_and_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_compute_geom ON events;
CREATE TRIGGER events_compute_geom
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION compute_geom_and_timestamp();
