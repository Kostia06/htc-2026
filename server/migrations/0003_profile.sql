-- one structured profile per person, AES-GCM encrypted with that person's key
CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
