-- "tell Raven how it went" by voice: who started which recap call, so only the owner can hand in its transcript
CREATE TABLE recap_voice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_slug TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX idx_recap_voice_sessions_user ON recap_voice_sessions(user_id, created_at);
