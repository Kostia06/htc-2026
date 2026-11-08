import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../src/db/types";
import { openTestDatabase, tableNames } from "./pglite";

let pg: Awaited<ReturnType<typeof openTestDatabase>>["pg"];
let database: Database;

beforeAll(async () => ({ pg, database } = await openTestDatabase()));
afterAll(() => pg.close());
beforeEach(() => pg.exec("DELETE FROM cache; DELETE FROM company_facts; DELETE FROM companies; DELETE FROM cooldowns; DELETE FROM user_resumes; DELETE FROM roadmap_steps"));

describe("schema", () => {
  it("creates every D1 table plus memory_vectors, all with row level security and no policies", async () => {
    const tables = await tableNames(pg);
    expect(tables).toEqual(
      [
        "agent_runs", "cache", "companies", "company_facts", "cooldowns", "courses", "experiences", "feed_actions", "feed_items", "feed_state",
        "headset_devices", "headset_launches", "host_fetches", "interview_sessions", "memory_vectors", "notification_devices", "notification_settings", "occupations", "pairing_offers", "path_outcomes",
        "postings", "recap_voice_sessions", "road_pattern_votes", "road_patterns", "roadmap_steps", "session_mints", "submission_log", "user_connections", "user_documents", "user_memories", "user_notifications", "user_profiles",
        "user_postings", "user_resumes", "user_tailored_resumes", "voice_sessions", "voice_turns",
      ].sort(),
    );
    const { rows } = await pg.query<{ tablename: string; rowsecurity: boolean }>("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'");
    expect(rows.every((r) => r.rowsecurity)).toBe(true);
    expect((await pg.query("SELECT count(*) AS n FROM pg_policies")).rows[0]).toEqual({ n: 0 });
    // 0018 dropped the QR pairing table
    expect(tables).not.toContain("device_pairings");
  });

  it("kept the rebuilt company_facts with the widened kind check and its index", async () => {
    await pg.exec("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')");
    await database.prepare("INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES (?, 'c1', 'interview_process', 'x', 'u', 'now', 'h1')").bind("f1").run();
    await expect(database.prepare("INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES (?, 'c1', 'gossip', 'x', 'u', 'now', 'h2')").bind("f2").run()).rejects.toThrow(/check/i);
    expect((await pg.query("SELECT indexname FROM pg_indexes WHERE tablename = 'company_facts'")).rows.map((r) => (r as { indexname: string }).indexname)).toContain("idx_facts_company");
  });
});

describe("D1-shaped results", () => {
  it("first() gives the row or null, first(column) the value, and counts are numbers", async () => {
    expect(await database.prepare("SELECT value FROM cache WHERE key = ?").bind("missing").first()).toBeNull();
    expect(await database.prepare("SELECT COUNT(*) AS n FROM cache").first<number>("n")).toBe(0);
    await database.prepare("INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)").bind("k", "v", "2999-01-01").run();
    expect(await database.prepare("SELECT value FROM cache WHERE key = ?").bind("k").first()).toEqual({ value: "v" });
    expect(await database.prepare("SELECT COUNT(*) AS n FROM cache").first<{ n: number }>()).toEqual({ n: 1 });
  });

  it("reports meta.changes for writes and 0 for reads", async () => {
    const inserted = await database.prepare("INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)").bind("a", "1", "2999").run();
    expect(inserted.meta.changes).toBe(1);
    expect((await database.prepare("UPDATE cache SET value = '2' WHERE key = ?").bind("nope").run()).meta.changes).toBe(0);
    expect((await database.prepare("SELECT * FROM cache").all()).meta.changes).toBe(0);
    const ignored = await database.prepare("INSERT OR IGNORE INTO cache (key, value, expires_at) VALUES (?, ?, ?)").bind("a", "9", "2999").run();
    expect(ignored.meta.changes).toBe(0);
    const replaced = await database.prepare("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)").bind("a", "9", "3000").run();
    expect(replaced.meta.changes).toBe(1);
    expect((await database.prepare("SELECT value, expires_at FROM cache WHERE key = 'a'").first())).toEqual({ value: "9", expires_at: "3000" });
  });

  it("RETURNING works through first() and all()", async () => {
    await database.prepare("INSERT INTO cooldowns (scope, key, last_run_at) VALUES ('s', 'k', '2020')").run();
    const claimed = await database
      .prepare(
        `INSERT INTO cooldowns (scope, key, last_run_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (scope, key) DO UPDATE SET last_run_at = excluded.last_run_at WHERE cooldowns.last_run_at < ?4 RETURNING key`,
      )
      .bind("s", "k", "2026", "2021")
      .first<{ key: string }>();
    expect(claimed).toEqual({ key: "k" });
    const blocked = await database.prepare("UPDATE cooldowns SET last_run_at = ? WHERE scope = 's' AND last_run_at < ? RETURNING key").bind("2027", "2000").first();
    expect(blocked).toBeNull();
    const { results } = await database.prepare("DELETE FROM cooldowns WHERE scope = ? RETURNING key").bind("s").all<{ key: string }>();
    expect(results).toEqual([{ key: "k" }]);
  });

  it("binds booleans as integers and reuses a bound statement without sharing values", async () => {
    await database.prepare("INSERT INTO companies (id, slug, name, tracked) VALUES (?, ?, ?, ?)").bind("c1", "acme", "Acme", true).run();
    expect(await database.prepare("SELECT tracked FROM companies WHERE tracked = 1").first()).toEqual({ tracked: 1 });
    const insert = database.prepare("INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)");
    await database.batch([insert.bind("x", "1", "2999"), insert.bind("y", "2", "2999")]);
    expect((await database.prepare("SELECT key FROM cache ORDER BY key").all()).results).toEqual([{ key: "x" }, { key: "y" }]);
  });
});

describe("batch", () => {
  it("returns one result per statement, in order", async () => {
    const [a, b, c] = await database.batch([
      database.prepare("INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)").bind("k1", "1", "2999"),
      database.prepare("SELECT value FROM cache WHERE key = ?").bind("k1"),
      database.prepare("DELETE FROM cache WHERE key = ?").bind("k1"),
    ]);
    expect(a.meta.changes).toBe(1);
    expect(b.results).toEqual([{ value: "1" }]);
    expect(c.meta.changes).toBe(1);
  });

  it("is one transaction: a failing statement rolls the earlier ones back, with a message the code recognises", async () => {
    await database.prepare("INSERT INTO user_resumes (user_id, ciphertext, iv, updated_at) VALUES ('u', 'c', 'i', 'now')").run();
    const error = await database
      .batch([
        database.prepare(
          "INSERT INTO roadmap_steps (id, user_id, position, source, ciphertext, iv, status, created_at, updated_at) VALUES ('s1', 'u', 0, 'template', 'c', 'i', 'todo', 'now', 'now')",
        ),
        database.prepare("INSERT INTO user_resumes (user_id, ciphertext, iv, updated_at) VALUES ('u', 'c', 'i', 'now')"),
      ])
      .catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    // stores treat a duplicate key as "someone else saved it first"
    expect(/UNIQUE|PRIMARY KEY/i.test((error as Error).message)).toBe(true);
    expect(await database.prepare("SELECT COUNT(*) AS n FROM roadmap_steps").first("n")).toBe(0);
  });
});
