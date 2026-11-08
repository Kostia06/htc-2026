-- one encrypted resume per person, sealed with their own key like user_profiles; never enters the shared index
CREATE TABLE user_resumes (
  user_id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
