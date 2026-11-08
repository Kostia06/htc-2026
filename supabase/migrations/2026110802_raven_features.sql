-- from 0019_roadmap_steps.sql
-- the roadmap is now one flat ordered list of steps per person: each step's text and the person's
-- note are encrypted together, while position, status and completion time stay plain so the page,
-- progress and streak can be built without decrypting anything the person hasn't asked to see
DROP TABLE IF EXISTS roadmap_units;
DROP TABLE IF EXISTS roadmap_steps;
CREATE TABLE roadmap_steps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('template', 'agent')),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('todo', 'started', 'done', 'skipped')),
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, position)
);
ALTER TABLE roadmap_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE roadmap_steps FROM anon, authenticated;
CREATE INDEX idx_roadmap_steps_user_status ON roadmap_steps(user_id, status, position);

-- from 0021_feed_sections.sql
-- the feed is now ranked per section (all, jobs, events, hackathons, courses); the table is a cache, so it is rebuilt
-- rather than migrated, and clearing feed_state makes every person's next request start that rebuild
DROP TABLE feed_items;
CREATE TABLE feed_items (
  user_id TEXT NOT NULL,
  section TEXT NOT NULL,
  position INTEGER NOT NULL,
  card TEXT NOT NULL,
  PRIMARY KEY (user_id, section, position)
);
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE feed_items FROM anon, authenticated;
DELETE FROM feed_state;
-- what a person did with a card: saved cards make the Saved section, dismissed ones never come back and steer ranking
CREATE TABLE feed_actions (
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('save', 'dismiss')),
  card TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
ALTER TABLE feed_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE feed_actions FROM anon, authenticated;
CREATE INDEX feed_actions_by_action ON feed_actions (user_id, action, created_at);

-- from 0023_resume.sql
-- one encrypted resume per person, sealed with their own key like user_profiles; never enters the shared index
CREATE TABLE user_resumes (
  user_id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_resumes FROM anon, authenticated;

-- from 0024_headset_devices.sql
-- a headset that pairs once is remembered: it holds a long-lived refresh credential (stored hashed) and
-- trades it for short access tokens, so it stays signed in across reloads and days until the phone revokes it
CREATE TABLE headset_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  refresh_hash TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);
ALTER TABLE headset_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE headset_devices FROM anon, authenticated;
CREATE INDEX idx_headset_devices_user ON headset_devices(user_id);
-- the phone asks the headset to start a session; one pending launch per person, picked up by the headset's poll
CREATE TABLE headset_launches (
  user_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('interview', 'networking')),
  company_slug TEXT,
  role TEXT,
  step_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
ALTER TABLE headset_launches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE headset_launches FROM anon, authenticated;

-- from 0025_recap_sessions.sql
-- "tell Raven how it went" by voice: who started which recap call, so only the owner can hand in its transcript
CREATE TABLE recap_voice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_slug TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
ALTER TABLE recap_voice_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE recap_voice_sessions FROM anon, authenticated;
CREATE INDEX idx_recap_voice_sessions_user ON recap_voice_sessions(user_id, created_at);

