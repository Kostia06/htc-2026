-- Crossroads: what everyone on a road has run into, as short anonymized lines. Seeded examples are flagged and
-- never counted as people; a real line is only shown once three different people stand behind it.
CREATE TABLE road_patterns (
  id TEXT PRIMARY KEY,
  lane TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  is_seeded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_road_patterns_lane ON road_patterns(lane);

-- one row per person per line, so every count is of distinct people; user_id is only ever counted, never returned
CREATE TABLE road_pattern_votes (
  pattern_id TEXT NOT NULL REFERENCES road_patterns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (pattern_id, user_id)
);
CREATE INDEX idx_road_pattern_votes_user ON road_pattern_votes(user_id);

-- the road one person took to a job they got: step kinds in order and skill names, no free text and no dates.
-- Seeded example roads have no user_id.
CREATE TABLE path_outcomes (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  lane TEXT NOT NULL,
  role TEXT NOT NULL,
  company_slug TEXT,
  steps_json TEXT NOT NULL,
  skills_json TEXT NOT NULL,
  is_seeded INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_path_outcomes_user_role ON path_outcomes(user_id, role);
CREATE INDEX idx_path_outcomes_lane ON path_outcomes(lane);

-- which road an employer sits on, so research facts can be shown to people heading that way
ALTER TABLE companies ADD COLUMN lane TEXT;

-- a keyed hash of whoever sent the report, so the three-report rule counts people rather than submissions
ALTER TABLE experiences ADD COLUMN contributor TEXT;
