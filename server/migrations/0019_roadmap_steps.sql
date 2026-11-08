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
CREATE INDEX idx_roadmap_steps_user_status ON roadmap_steps(user_id, status, position);
