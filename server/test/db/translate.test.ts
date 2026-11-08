import { describe, expect, it } from "vitest";
import { splitStatements, translate, translateMigration, UnsupportedSql } from "../../src/db/translate";

describe("translate: placeholders", () => {
  it("numbers bare ? in order", () => {
    expect(translate("SELECT * FROM t WHERE a = ? AND b = ?")).toBe("SELECT * FROM t WHERE a = $1 AND b = $2");
  });

  it("keeps explicit ?N numbers and lets a later bare ? continue after the highest", () => {
    expect(translate("INSERT INTO t (a, b) VALUES (?1, ?2) ON CONFLICT (a) DO UPDATE SET b = ?2 WHERE t.c < ?3")).toBe(
      "INSERT INTO t (a, b) VALUES ($1, $2) ON CONFLICT (a) DO UPDATE SET b = $2 WHERE t.c < $3",
    );
    expect(translate("SELECT ?2, ?, ?1")).toBe("SELECT $2, $3, $1");
  });

  it("leaves question marks inside string literals, quoted identifiers and comments alone", () => {
    expect(translate(`SELECT 'why?' AS "q?" FROM t WHERE a = ? -- really?`)).toBe(`SELECT 'why?' AS "q?" FROM t WHERE a = $1 -- really?`);
    expect(translate("SELECT 'it''s?' FROM t WHERE a = ?")).toBe("SELECT 'it''s?' FROM t WHERE a = $1");
  });

  it("handles a cast right after a placeholder", () => {
    expect(translate("SELECT ?1::vector, ?::jsonb")).toBe("SELECT $1::vector, $2::jsonb");
  });
});

describe("translate: inserts", () => {
  it("turns INSERT OR IGNORE into ON CONFLICT DO NOTHING", () => {
    expect(translate("INSERT OR IGNORE INTO companies (id, slug, name) VALUES (?, ?, ?)")).toBe(
      "INSERT INTO companies (id, slug, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    );
  });

  it("keeps a RETURNING clause after the conflict clause", () => {
    expect(translate("INSERT OR IGNORE INTO companies (id, slug, name) VALUES (?, ?, ?) RETURNING id")).toBe(
      "INSERT INTO companies (id, slug, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id",
    );
  });

  it("turns INSERT OR REPLACE into an upsert on the table's primary key", () => {
    expect(translate("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)")).toBe(
      "INSERT INTO cache (key, value, expires_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
    );
    expect(translate("INSERT OR REPLACE INTO cooldowns (scope, key, last_run_at) VALUES (?, ?, ?)")).toContain(
      "ON CONFLICT (scope, key) DO UPDATE SET last_run_at = excluded.last_run_at",
    );
  });

  it("refuses INSERT OR REPLACE into a table whose key it does not know", () => {
    expect(() => translate("INSERT OR REPLACE INTO mystery (a) VALUES (?)")).toThrow(UnsupportedSql);
    expect(() => translate("INSERT OR REPLACE INTO cache VALUES (?, ?, ?)")).toThrow(/column list/);
  });

  it("passes Postgres-style upserts and RETURNING through unchanged", () => {
    const sql = `INSERT INTO host_fetches (host, last_fetched_at) VALUES (?1, ?2)
     ON CONFLICT (host) DO UPDATE SET last_fetched_at = excluded.last_fetched_at WHERE host_fetches.last_fetched_at <= ?3
     RETURNING host`;
    expect(translate(sql)).toBe(sql.replace("?1", "$1").replace("?2", "$2").replace("?3", "$3"));
  });
});

describe("translate: functions and keywords", () => {
  it("formats datetime('now') as the same ISO-like text SQLite produces", () => {
    expect(translate("SELECT datetime('now')")).toBe("SELECT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')");
    expect(translate("SELECT datetime('now', '-7 days')")).toBe("SELECT to_char(now() at time zone 'utc' - interval '7 days', 'YYYY-MM-DD HH24:MI:SS')");
  });

  it("maps strftime directives to to_char patterns, quoting literal letters", () => {
    expect(translate("UPDATE t SET at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")).toBe(
      `UPDATE t SET at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') WHERE id = $1`,
    );
    expect(() => translate("SELECT strftime('%s', 'now')")).toThrow(/%s/);
    expect(() => translate("SELECT datetime(created_at)")).toThrow(UnsupportedSql);
  });

  it("rewrites IFNULL, instr and LIKE (SQLite's LIKE ignores case)", () => {
    expect(translate("SELECT IFNULL(a, 0), instr(a, 'x') FROM t WHERE key LIKE 'feed:%' AND b NOT LIKE ?")).toBe(
      "SELECT COALESCE(a, 0), strpos(a, 'x') FROM t WHERE key ILIKE 'feed:%' AND b NOT ILIKE $1",
    );
  });

  it("leaves ||, substr, length, lower, COALESCE, COUNT, CASE, subqueries, LIMIT and IN lists alone", () => {
    const sql = `DELETE FROM user_memories WHERE user_id = ? AND id IN (
      SELECT id FROM user_memories WHERE user_id = ? ORDER BY last_used_at ASC, created_at ASC LIMIT ?
    )`;
    expect(translate(sql)).toBe(sql.replace("= ?", "= $1").replace("user_id = ? ORDER", "user_id = $2 ORDER").replace("LIMIT ?", "LIMIT $3"));
    expect(translate("DELETE FROM cache WHERE substr(key, 1, length(?1)) = ?1")).toBe("DELETE FROM cache WHERE substr(key, 1, length($1)) = $1");
    expect(translate("SELECT a || ' ' || lower(b), COALESCE(MAX(idx) + 1, 0), COUNT(*) AS n FROM t")).toBe(
      "SELECT a || ' ' || lower(b), COALESCE(MAX(idx) + 1, 0), COUNT(*) AS n FROM t",
    );
  });

  it("fails loudly on SQLite-only functions and clauses", () => {
    for (const sql of [
      "SELECT last_insert_rowid()",
      "SELECT julianday('now')",
      "SELECT group_concat(a) FROM t",
      "SELECT json_extract(card, '$.id') FROM feed_items",
      "SELECT changes()",
      "PRAGMA foreign_keys = ON",
      "SELECT a FROM t WHERE a GLOB('x*')",
      "SELECT a FROM t ORDER BY a COLLATE NOCASE",
    ]) {
      expect(() => translate(sql), sql).toThrow(UnsupportedSql);
    }
  });

  it("refuses an unquoted mixed-case alias, which Postgres would fold to lower case", () => {
    expect(() => translate("SELECT count(*) AS thisWeek FROM t")).toThrow(/thisWeek/);
    expect(translate(`SELECT count(*) AS "thisWeek", count(*) AS n, CAST(? AS TEXT) FROM t`)).toBe(`SELECT count(*) AS "thisWeek", count(*) AS n, CAST($1 AS TEXT) FROM t`);
  });
});

describe("translateMigration", () => {
  it("splits on semicolons outside strings and comments", () => {
    expect(splitStatements("CREATE TABLE a (x TEXT DEFAULT ';'); -- note; here\nCREATE INDEX i ON a(x);")).toEqual([
      "CREATE TABLE a (x TEXT DEFAULT ';')",
      " -- note; here\nCREATE INDEX i ON a(x)",
    ]);
  });

  it("translates DDL types, enables row level security and revokes public access on every new table", () => {
    const out = translateMigration(`-- wages
CREATE TABLE postings (
  id TEXT PRIMARY KEY,
  wage_min REAL,
  payload BLOB,
  tracked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) WITHOUT ROWID;
CREATE INDEX idx_postings_wage ON postings(wage_min);
INSERT OR IGNORE INTO postings (id) VALUES ('seed');
`);
    expect(out).toContain("wage_min DOUBLE PRECISION");
    expect(out).toContain("payload BYTEA");
    expect(out).toContain("DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))");
    expect(out).not.toMatch(/WITHOUT ROWID/);
    expect(out).toContain("ALTER TABLE postings ENABLE ROW LEVEL SECURITY;");
    expect(out).toContain("REVOKE ALL ON TABLE postings FROM anon, authenticated;");
    expect(out).toContain("INSERT INTO postings (id) VALUES ('seed') ON CONFLICT DO NOTHING;");
    expect(out.indexOf("CREATE INDEX")).toBeGreaterThan(out.indexOf("ENABLE ROW LEVEL SECURITY"));
  });

  it("maps INTEGER PRIMARY KEY AUTOINCREMENT to BIGSERIAL and rejects AUTOINCREMENT anywhere else", () => {
    expect(translateMigration("CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, n INTEGER);", { rls: false })).toBe(
      "CREATE TABLE t (id BIGSERIAL PRIMARY KEY, n INTEGER);\n",
    );
    expect(() => translateMigration("CREATE TABLE t (id INTEGER AUTOINCREMENT);")).toThrow(UnsupportedSql);
  });

  it("carries a table rebuild (create new, copy, drop, rename) through unchanged", () => {
    const out = translateMigration(
      "CREATE TABLE a_new (id TEXT PRIMARY KEY);\nINSERT INTO a_new SELECT id FROM a;\nDROP TABLE a;\nALTER TABLE a_new RENAME TO a;\nCREATE INDEX idx_a ON a(id);",
      { rls: false },
    );
    expect(out.split("\n").filter(Boolean)).toEqual([
      "CREATE TABLE a_new (id TEXT PRIMARY KEY);",
      "INSERT INTO a_new SELECT id FROM a;",
      "DROP TABLE a;",
      "ALTER TABLE a_new RENAME TO a;",
      "CREATE INDEX idx_a ON a(id);",
    ]);
  });
});
