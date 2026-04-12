-- ThreatWatch Risk Scores — computed daily for every country
-- 8-component weighted composite (Part 4 blueprint):
--   conflict_intensity 25%, escalation_trajectory 20%, humanitarian_severity 15%,
--   satellite_indicators 10%, media_anomaly 10%, economic_stress 10%,
--   sanctions_pressure 5%, historical_pattern 5%
-- Populated by riskScorer cron (daily).
CREATE TABLE IF NOT EXISTS risk_scores (
  id                       SERIAL PRIMARY KEY,
  country                  TEXT NOT NULL,
  iso_a3                   TEXT,
  date                     DATE NOT NULL,
  overall_score            DOUBLE PRECISION NOT NULL,  -- 0-100
  conflict_intensity       DOUBLE PRECISION,           -- 0-100 component
  escalation_trajectory    DOUBLE PRECISION,           -- 0-100 component
  humanitarian_severity    DOUBLE PRECISION,           -- 0-100 component
  satellite_indicators     DOUBLE PRECISION,           -- 0-100 component
  media_anomaly            DOUBLE PRECISION,           -- 0-100 component
  economic_stress          DOUBLE PRECISION,           -- 0-100 component
  sanctions_pressure       DOUBLE PRECISION,           -- 0-100 component
  historical_pattern       DOUBLE PRECISION,           -- 0-100 component
  risk_level               TEXT,                       -- 'critical', 'elevated', 'watch', 'stable'
  contributing_factors     JSONB,                      -- top 3 factors + values
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country, date)
);

CREATE INDEX IF NOT EXISTS idx_risk_country ON risk_scores(country);
CREATE INDEX IF NOT EXISTS idx_risk_date    ON risk_scores(date DESC);
CREATE INDEX IF NOT EXISTS idx_risk_level   ON risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_score   ON risk_scores(overall_score DESC);
