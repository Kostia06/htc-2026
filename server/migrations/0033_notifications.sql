-- what Skillit decided was worth telling someone; the title, line and tap target are sealed with the person's key,
-- the kind and dedupe key stay plain so the generator can skip what it already said without decrypting anything
CREATE TABLE user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  -- set once a push went out (or was given up on), so the cron never pushes the same thing twice
  pushed_at TEXT,
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX idx_user_notifications_user ON user_notifications(user_id, created_at);

-- one row per person: their timezone (for quiet hours), the kinds they turned off, and when the generator last ran
CREATE TABLE notification_settings (
  user_id TEXT PRIMARY KEY,
  timezone TEXT,
  disabled_kinds TEXT NOT NULL DEFAULT '[]',
  checked_at TEXT,
  updated_at TEXT NOT NULL
);

-- a device's APNs token; keyed by token so a phone that signs into another account moves with it
CREATE TABLE notification_devices (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_notification_devices_user ON notification_devices(user_id);
