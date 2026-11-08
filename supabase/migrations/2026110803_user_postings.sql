-- from 0026_user_postings.sql
-- a job posting the person is preparing for: the extracted posting and its have/missing marks are encrypted
-- together, like roadmap steps; the company slug stays plain so the interview planner can find the company
CREATE TABLE user_postings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_slug TEXT,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL
);
ALTER TABLE user_postings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_postings FROM anon, authenticated;
CREATE INDEX idx_user_postings_user ON user_postings(user_id, created_at);

