-- uploaded files are never kept: only their extracted text, encrypted per user, for one hour
CREATE TABLE user_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_user_documents_expiry ON user_documents(expires_at);
