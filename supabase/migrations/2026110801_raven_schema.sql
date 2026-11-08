-- Raven server schema on Supabase Postgres: a translation of the D1 migrations server/migrations/0001–0018.
--
-- GENERATED, do not edit the table section by hand. Regenerate with
--   cd server && node scripts/sqlite-to-postgres.mjs migrations/*.sql
-- and paste the output between the BEGIN/END GENERATED markers. Later D1 migrations (0019 on) become their own
-- Supabase migration files the same way, one `node scripts/sqlite-to-postgres.mjs migrations/00NN_x.sql` each.
--
-- Conventions kept from D1 so the server code runs unchanged: TEXT ids, ISO-8601 TEXT timestamps, 0/1 INTEGER flags,
-- JSON kept as TEXT. Every table has ROW LEVEL SECURITY on with no policies and public roles revoked: nothing here is
-- reachable through PostgREST with the anon/publishable key. The Worker connects through Hyperdrive as the `postgres`
-- role, which owns these tables and is therefore not subject to RLS (see server/README.md, "Database: Supabase").
--
-- Relationship to public.profiles (20261107000000_profiles.sql): that table is one row per Supabase account (uuid id,
-- name, email) and stays as is. The server's encrypted per-person data lives in user_profiles, user_memories,
-- roadmap_*, voice_*, feed_* and user_documents, all keyed by user_id TEXT. For someone signed in with Supabase,
-- user_id is their auth.users.id (and so profiles.id) as text; there is no foreign key because user_id can also be a
-- server-minted session id (headsets, anonymous sessions) that has no Supabase account.

create extension if not exists vector;

-- BEGIN GENERATED
-- from 0001_core.sql
CREATE TABLE occupations (
  noc TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  region TEXT NOT NULL,
  outlook TEXT,
  outlook_score INTEGER NOT NULL DEFAULT 0,
  trends TEXT,
  median_wage DOUBLE PRECISION,
  vacancies INTEGER,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
ALTER TABLE occupations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE occupations FROM anon, authenticated;
CREATE TABLE postings (
  id TEXT PRIMARY KEY,
  noc TEXT,
  title TEXT NOT NULL,
  city TEXT,
  wage_min DOUBLE PRECISION,
  wage_max DOUBLE PRECISION,
  wage_per TEXT,
  education TEXT,
  experience TEXT,
  posted_on TEXT,
  source TEXT NOT NULL,
  url TEXT
);
ALTER TABLE postings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE postings FROM anon, authenticated;
CREATE INDEX idx_postings_noc ON postings(noc);
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  school TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT
);
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE courses FROM anon, authenticated;
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  website TEXT,
  tracked INTEGER NOT NULL DEFAULT 0,
  last_researched_at TEXT
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE companies FROM anon, authenticated;
CREATE TABLE company_facts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('about', 'hiring', 'interview', 'tech', 'news')),
  text TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE
);
ALTER TABLE company_facts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE company_facts FROM anon, authenticated;
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
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE experiences FROM anon, authenticated;
CREATE INDEX idx_experiences_company ON experiences(company_id);
CREATE TABLE submission_log (
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
ALTER TABLE submission_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE submission_log FROM anon, authenticated;
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
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE interview_sessions FROM anon, authenticated;

-- from 0002_memory_agent.sql
CREATE TABLE session_mints (
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
ALTER TABLE session_mints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE session_mints FROM anon, authenticated;
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
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_memories FROM anon, authenticated;
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
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE agent_runs FROM anon, authenticated;
CREATE INDEX idx_agent_runs_user ON agent_runs(user_id, created_at);
CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
ALTER TABLE cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cache FROM anon, authenticated;

-- from 0003_profile.sql
-- one structured profile per person, AES-GCM encrypted with that person's key
CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_profiles FROM anon, authenticated;

-- from 0012_freshness.sql
-- when we last fetched a page from each host, so a site's robots.txt Crawl-delay is honoured across requests
CREATE TABLE host_fetches (
  host TEXT PRIMARY KEY,
  last_fetched_at TEXT NOT NULL
);
ALTER TABLE host_fetches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE host_fetches FROM anon, authenticated;
-- per-skill run cooldowns (e.g. interview-intel once a day per company), separate from research's
CREATE TABLE cooldowns (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  last_run_at TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);
ALTER TABLE cooldowns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cooldowns FROM anon, authenticated;
-- SQLite can't alter a CHECK constraint, so the table is rebuilt to accept the interview_process kind
CREATE TABLE company_facts_new (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('about', 'hiring', 'interview', 'interview_process', 'tech', 'news')),
  text TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE
);
ALTER TABLE company_facts_new ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE company_facts_new FROM anon, authenticated;
INSERT INTO company_facts_new SELECT id, company_id, kind, text, source_url, fetched_at, content_hash FROM company_facts;
DROP TABLE company_facts;
ALTER TABLE company_facts_new RENAME TO company_facts;
CREATE INDEX idx_facts_company ON company_facts(company_id);

-- from 0013_documents.sql
-- uploaded files are never kept: only their extracted text, encrypted per user, for one hour
CREATE TABLE user_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_documents FROM anon, authenticated;
CREATE INDEX idx_user_documents_expiry ON user_documents(expires_at);

-- from 0014_pairings.sql
-- a headset shows a short code as a QR; a signed-in phone approves it; the headset collects a token once
CREATE TABLE device_pairings (
  code TEXT PRIMARY KEY,
  poll_hash TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'claimed')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
ALTER TABLE device_pairings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE device_pairings FROM anon, authenticated;
CREATE INDEX idx_device_pairings_expiry ON device_pairings(expires_at);

-- from 0015_voice_sessions.sql
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
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE voice_sessions FROM anon, authenticated;
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
ALTER TABLE voice_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE voice_turns FROM anon, authenticated;

-- from 0016_roadmap.sql
-- the roadmap toward a person's goal job: each unit's text is encrypted per user, while step
-- statuses stay plain so progress can be counted without decrypting anything
CREATE TABLE roadmap_units (
  user_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, idx)
);
ALTER TABLE roadmap_units ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE roadmap_units FROM anon, authenticated;
CREATE TABLE roadmap_steps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  unit_idx INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('todo', 'started', 'done', 'skipped')),
  updated_at TEXT NOT NULL
);
ALTER TABLE roadmap_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE roadmap_steps FROM anon, authenticated;
CREATE INDEX idx_roadmap_steps_user ON roadmap_steps(user_id, status, updated_at);

-- from 0017_feed.sql
-- each person's precomputed For you feed, ranked at build time so GET /api/feed only reads rows in order
CREATE TABLE feed_items (
  user_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  card TEXT NOT NULL,
  PRIMARY KEY (user_id, position)
);
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE feed_items FROM anon, authenticated;
-- built_at is null until the first build finishes; building_since claims a rebuild so two requests don't both run one
CREATE TABLE feed_state (
  user_id TEXT PRIMARY KEY,
  built_at TEXT,
  building_since TEXT
);
ALTER TABLE feed_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE feed_state FROM anon, authenticated;

-- from 0018_pairing_offers.sql
-- the phone now shows a 4-digit code and the headset types it in; the QR flow's table goes
DROP TABLE IF EXISTS device_pairings;
-- one live code per person (user_id is the key); codes are unique while they last
CREATE TABLE pairing_offers (
  user_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'claimed')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
ALTER TABLE pairing_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pairing_offers FROM anon, authenticated;
CREATE INDEX idx_pairing_offers_expiry ON pairing_offers(expires_at);

-- END GENERATED

-- Vectors (replaces the Vectorize index): one row per fact or experience embedding, 768 dims from @cf/baai/bge-base-en-v1.5.
-- metadata holds {company_id, kind}; namespace mirrors Vectorize's optional namespace and is unused today.
CREATE TABLE memory_vectors (
  id TEXT PRIMARY KEY,
  embedding vector(768) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  namespace TEXT
);
CREATE INDEX idx_memory_vectors_embedding ON memory_vectors USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_memory_vectors_metadata ON memory_vectors USING gin (metadata jsonb_path_ops);
ALTER TABLE memory_vectors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE memory_vectors FROM anon, authenticated;
