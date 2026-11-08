-- a copy of the person's resume adapted to one job, with its change log and match summary, sealed with their own
-- key like user_resumes; posting_id stays plain so a version can be found from the posting it was made for
CREATE TABLE user_tailored_resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  posting_id TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_user_tailored_resumes_user ON user_tailored_resumes(user_id, updated_at);
