-- when we last fetched a page from each host, so a site's robots.txt Crawl-delay is honoured across requests
CREATE TABLE host_fetches (
  host TEXT PRIMARY KEY,
  last_fetched_at TEXT NOT NULL
);

-- per-skill run cooldowns (e.g. interview-intel once a day per company), separate from research's
CREATE TABLE cooldowns (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  last_run_at TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);

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
INSERT INTO company_facts_new SELECT id, company_id, kind, text, source_url, fetched_at, content_hash FROM company_facts;
DROP TABLE company_facts;
ALTER TABLE company_facts_new RENAME TO company_facts;
CREATE INDEX idx_facts_company ON company_facts(company_id);
