-- an outside account a person linked (today only GitHub, read-only, through Composio). account_id is Composio's id for the
-- connection, not a credential: the OAuth token stays at Composio and never reaches us. The sealed part holds only what the
-- import derived (repo names, grounded one-line summaries, language, topics, stars), never raw GitHub data or a README
CREATE TABLE user_connections (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  -- 'pending' until the person finishes on GitHub, then 'active'; 'revoking' when the Composio delete failed and must be retried
  status TEXT NOT NULL,
  ciphertext TEXT,
  iv TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider)
);
