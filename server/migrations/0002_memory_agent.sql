CREATE TABLE session_mints (
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_session_mints ON session_mints(ip_hash, created_at);

-- private memory: text is AES-GCM encrypted per user, never stored or embedded in plain form
CREATE TABLE user_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('goal', 'skill', 'weakness', 'preference', 'note')),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_user_memories_user ON user_memories(user_id, last_used_at);

CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'done', 'failed')),
  output TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX idx_agent_runs_user ON agent_runs(user_id, created_at);

CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
