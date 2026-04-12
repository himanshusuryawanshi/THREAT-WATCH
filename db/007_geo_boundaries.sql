CREATE TABLE IF NOT EXISTS geo_boundaries (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  iso_a3       TEXT,
  iso_a2       TEXT,
  admin_level  INTEGER DEFAULT 0,
  parent_id    INTEGER REFERENCES geo_boundaries(id),
  population   BIGINT,
  geom         GEOMETRY(MultiPolygon, 4326),
  centroid_lat DOUBLE PRECISION,
  centroid_lng DOUBLE PRECISION,
  disputed     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_boundaries_iso ON geo_boundaries(iso_a3);
CREATE INDEX IF NOT EXISTS idx_geo_boundaries_geom ON geo_boundaries USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_geo_boundaries_level ON geo_boundaries(admin_level);
