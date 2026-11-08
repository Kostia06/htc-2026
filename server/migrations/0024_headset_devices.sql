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
