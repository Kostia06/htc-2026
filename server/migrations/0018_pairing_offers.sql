-- the phone now shows a 4-digit code and the headset types it in; the QR flow's table goes
DROP TABLE IF EXISTS device_pairings;

-- one live code per person (user_id is the key); codes are unique while they last
CREATE TABLE pairing_offers (
  user_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'claimed')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_pairing_offers_expiry ON pairing_offers(expires_at);
