-- the roadmap toward a person's goal job: each unit's text is encrypted per user, while step
-- statuses stay plain so progress can be counted without decrypting anything
CREATE TABLE roadmap_units (
  user_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, idx)
);

CREATE TABLE roadmap_steps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  unit_idx INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('todo', 'started', 'done', 'skipped')),
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_roadmap_steps_user ON roadmap_steps(user_id, status, updated_at);
