-- NASA FIRMS thermal anomalies
-- Independent satellite layer — NOT UCDP events, plotted separately as orange pulses
CREATE TABLE IF NOT EXISTS thermal_anomalies (
  id               SERIAL PRIMARY KEY,
  latitude         DOUBLE PRECISION NOT NULL,
  longitude        DOUBLE PRECISION NOT NULL,
  geom             GEOMETRY(Point, 4326),
  brightness       DOUBLE PRECISION,
  frp              DOUBLE PRECISION,          -- Fire Radiative Power (MW)
  confidence       TEXT,                       -- 'low', 'nominal', 'high'
  satellite        TEXT,                       -- 'VIIRS', 'MODIS'
  acq_date         DATE NOT NULL,
  acq_time         TEXT,
  daynight         TEXT,                       -- 'D' or 'N'
  in_conflict_zone BOOLEAN DEFAULT FALSE,      -- cross-referenced with UCDP events
  nearest_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thermal_geom     ON thermal_anomalies USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_thermal_date     ON thermal_anomalies(acq_date DESC);
CREATE INDEX IF NOT EXISTS idx_thermal_conflict ON thermal_anomalies(in_conflict_zone);
CREATE INDEX IF NOT EXISTS idx_thermal_frp      ON thermal_anomalies(frp DESC) WHERE frp IS NOT NULL;

-- Auto-compute geom from lat/lng on insert/update
CREATE OR REPLACE FUNCTION thermal_compute_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS thermal_anomalies_compute_geom ON thermal_anomalies;
CREATE TRIGGER thermal_anomalies_compute_geom
  BEFORE INSERT OR UPDATE ON thermal_anomalies
  FOR EACH ROW EXECUTE FUNCTION thermal_compute_geom();

-- Unique constraint to prevent duplicate ingestion of same satellite pass
CREATE UNIQUE INDEX IF NOT EXISTS idx_thermal_dedup
  ON thermal_anomalies(satellite, acq_date, latitude, longitude);
