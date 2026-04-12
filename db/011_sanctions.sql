-- OpenSanctions entity data
-- Commercial license required (~€2000/yr). Powers actor badges and sanctions overlay.
-- Populated by sanctionsPoller cron (daily).
CREATE TABLE IF NOT EXISTS sanctions (
  id                  TEXT PRIMARY KEY,        -- OpenSanctions entity ID
  name                TEXT NOT NULL,
  entity_type         TEXT,                    -- 'person', 'organization', 'vessel'
  aliases             TEXT[],
  nationality         TEXT,
  sanction_authorities TEXT[],                 -- ['OFAC', 'EU', 'UN']
  sanction_types      TEXT[],                  -- ['asset_freeze', 'travel_ban', 'arms_embargo']
  topics              TEXT[],                  -- ['terrorism', 'human_rights', 'sanctions']
  first_seen          DATE,
  last_seen           DATE,
  properties          JSONB,
  actor_id            TEXT REFERENCES actors(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sanctions_name_fts ON sanctions USING GIN(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_sanctions_actor     ON sanctions(actor_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_type      ON sanctions(entity_type);
CREATE INDEX IF NOT EXISTS idx_sanctions_authorities ON sanctions USING GIN(sanction_authorities);
