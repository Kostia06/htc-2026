-- a headset shows a short code as a QR; a signed-in phone approves it; the headset collects a token once
CREATE TABLE device_pairings (
  code TEXT PRIMARY KEY,
  poll_hash TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'claimed')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_device_pairings_expiry ON device_pairings(expires_at);
