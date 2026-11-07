-- voice practice: the plan and every answer are encrypted per user, and only the owner can read them back
CREATE TABLE voice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('interview', 'networking')),
  company_slug TEXT,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'finished')),
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX idx_voice_sessions_user ON voice_sessions(user_id, created_at);

CREATE TABLE voice_turns (
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (session_id, idx)
);
