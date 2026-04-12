-- Migration for existing databases: bring old schema up to blueprint spec.
-- Safe to run multiple times (uses IF NOT EXISTS / DO NOTHING patterns).

-- 1. Rename actor → actor1 if not already done
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='events' AND column_name='actor'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='events' AND column_name='actor1'
  ) THEN
    ALTER TABLE events RENAME COLUMN actor TO actor1;
  END IF;
END $$;

-- 2. Rename fatal → fatalities if not already done
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='events' AND column_name='fatal'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='events' AND column_name='fatalities'
  ) THEN
    ALTER TABLE events RENAME COLUMN fatal TO fatalities;
  END IF;
END $$;

-- 3. Add new columns if missing
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS source_id       TEXT,
  ADD COLUMN IF NOT EXISTS admin1          TEXT,
  ADD COLUMN IF NOT EXISTS geo_precision   INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS fatalities_low  INTEGER,
  ADD COLUMN IF NOT EXISTS fatalities_high INTEGER,
  ADD COLUMN IF NOT EXISTS url             TEXT,
  ADD COLUMN IF NOT EXISTS tone            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS goldstein       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS conflict_id     TEXT;

-- 4. Fix source column default: remove 'ACLED' default, make NOT NULL via UPDATE then constraint
UPDATE events SET source = 'GDELT' WHERE source IS NULL OR source = 'ACLED';
ALTER TABLE events ALTER COLUMN source SET NOT NULL;

-- 5. Add deduplication unique index (source, source_id) — skip if source_id is null for old rows
-- First populate source_id from id for existing rows
UPDATE events SET source_id = regexp_replace(id, '^GDELT_', '') WHERE source = 'GDELT' AND source_id IS NULL;
UPDATE events SET source_id = regexp_replace(id, '^UCDP_', '')  WHERE source = 'UCDP'  AND source_id IS NULL;

-- 6. Replace the old trigger with the new one that also computes geom
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

DROP TRIGGER IF EXISTS events_updated_at       ON events;
DROP TRIGGER IF EXISTS events_compute_geom     ON events;
CREATE TRIGGER events_compute_geom
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION compute_geom_and_timestamp();

-- 7. Add new indexes
CREATE INDEX IF NOT EXISTS idx_events_source       ON events(source);
CREATE INDEX IF NOT EXISTS idx_events_conflict     ON events(conflict_id);
CREATE INDEX IF NOT EXISTS idx_events_geo_precision ON events(geo_precision);

-- 8. Unique index for dedup (full, not partial — required for ON CONFLICT to work)
-- NULLs in source_id are fine since NULL != NULL in postgres unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_dedup ON events(source, source_id);
