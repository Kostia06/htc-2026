CREATE TABLE occupations (
  noc TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  region TEXT NOT NULL,
  outlook TEXT,
  outlook_score INTEGER NOT NULL DEFAULT 0,
  trends TEXT,
  median_wage REAL,
  vacancies INTEGER,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE postings (
  id TEXT PRIMARY KEY,
  noc TEXT,
  title TEXT NOT NULL,
  city TEXT,
  wage_min REAL,
  wage_max REAL,
  wage_per TEXT,
  education TEXT,
  experience TEXT,
  posted_on TEXT,
  source TEXT NOT NULL,
  url TEXT
);
CREATE INDEX idx_postings_noc ON postings(noc);

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  school TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT
);

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  website TEXT,
  tracked INTEGER NOT NULL DEFAULT 0,
  last_researched_at TEXT
);

CREATE TABLE company_facts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('about', 'hiring', 'interview', 'tech', 'news')),
  text TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE
);
CREATE INDEX idx_facts_company ON company_facts(company_id);

-- deliberately no author column: experiences are anonymous by construction
CREATE TABLE experiences (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  questions_json TEXT NOT NULL DEFAULT '[]',
  format TEXT,
  outcome TEXT,
  tips TEXT,
  is_seeded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_experiences_company ON experiences(company_id);

CREATE TABLE submission_log (
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_submission_log ON submission_log(session_id, created_at);

CREATE TABLE interview_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  company_id TEXT,
  role TEXT NOT NULL,
  turns_json TEXT NOT NULL DEFAULT '[]',
  summary_json TEXT,
  created_at TEXT NOT NULL
);
