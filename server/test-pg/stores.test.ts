// The real store modules, unchanged, running on Postgres through db(env). Each one holds the SQL the Worker ships.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { recordRunDone, recordRunStart, findRun } from "../src/agents/core/runs";
import { claimCode, deleteExpiredPairings, offerCode, offerStatus } from "../src/auth/pairing";
import { deleteDocument, deleteExpiredDocuments, readDocument, saveDocument } from "../src/documents/store";
import type { Env } from "../src/env";
import { claimRebuild, isStale, readFeed, releaseClaim, saveFeed, staleFeedOwners } from "../src/feed/store";
import { cached, invalidate } from "../src/memory/cache";
import { claimCooldown } from "../src/memory/cooldowns";
import { deps as factDeps, saveFact } from "../src/memory/facts";
import { collectGarbage, deps as gcDeps } from "../src/memory/gc";
import { claimFetchSlot } from "../src/memory/host-fetches";
import { getCompanyInsights } from "../src/memory/insights";
import { forget, listMemories, recall, remember } from "../src/memory/private/store";
import { deleteProfile, getProfile, updateProfile } from "../src/memory/profile/store";
import { countSteps, insertSteps, loadCompleted, loadOpen, setStepStatus } from "../src/roadmap/store";
import { findPosting, listPostings, newPostingId, savePosting } from "../src/postings/store";
import { addTurn, countSessionsSince, createSession, deleteOldSessions, findSession, finishSession, listTurns } from "../src/voice/store";
import { claimDraftBuild, clearDraftWanted, markDraftWanted, readDraft, releaseDraftBuild, saveDraft } from "../src/voice/draft-store";
import { openTestDatabase } from "./pglite";

let db: Awaited<ReturnType<typeof openTestDatabase>>;
let env: Env;
const NOW = new Date("2026-06-01T00:00:00.000Z");

beforeAll(async () => {
  db = await openTestDatabase();
  env = db.env;
});
afterAll(() => db.pg.close());
beforeEach(async () => {
  const tables = ["cache", "company_facts", "experiences", "companies", "cooldowns", "host_fetches", "user_memories", "user_profiles", "agent_runs", "pairing_offers", "user_documents", "voice_turns", "voice_sessions", "roadmap_steps", "feed_items", "feed_state", "user_postings", "memory_vectors"];
  await db.pg.exec(tables.map((t) => `DELETE FROM ${t}`).join("; "));
});

describe("cache", () => {
  it("stores, hits, replaces and invalidates by prefix", async () => {
    expect(await cached(env, "a:1", 60, async () => ({ v: 1 }))).toEqual({ v: 1 });
    expect(await cached(env, "a:1", 60, async () => ({ v: 2 }))).toEqual({ v: 1 });
    await invalidate(env, "a:");
    expect(await cached(env, "a:1", 60, async () => ({ v: 3 }))).toEqual({ v: 3 });
  });
});

describe("facts and insights", () => {
  it("saves once per content hash and re-verifies duplicates", async () => {
    await db.pg.exec("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')");
    const upsert = vi.spyOn(factDeps, "upsertVector").mockResolvedValue();
    expect(await saveFact(env, "c1", { kind: "about", text: "Acme makes anvils", source_url: "https://acme.com" })).toEqual({ saved: true });
    expect(await saveFact(env, "c1", { kind: "about", text: "acme makes anvils ", source_url: "https://acme.com/x" })).toEqual({ saved: false, reason: "duplicate" });
    expect(upsert).toHaveBeenCalledTimes(1);
    const insights = await getCompanyInsights(env, "acme");
    expect(insights?.facts.map((f) => f.text)).toEqual(["Acme makes anvils"]);
    expect(insights?.reportCount).toBe(0);
  });
});

describe("atomic claims", () => {
  it("cooldown: one of two racing claims wins", async () => {
    expect(await claimCooldown(env, "intel", "acme", 60_000, NOW)).toBe(true);
    expect(await claimCooldown(env, "intel", "acme", 60_000, NOW)).toBe(false);
    expect(await claimCooldown(env, "intel", "acme", 60_000, new Date(NOW.getTime() + 61_000))).toBe(true);
  });

  it("host fetch slots honour the crawl delay", async () => {
    expect(await claimFetchSlot(env, "acme.com", 5, NOW)).toBe(true);
    expect(await claimFetchSlot(env, "acme.com", 5, new Date(NOW.getTime() + 1000))).toBe(false);
    expect(await claimFetchSlot(env, "acme.com", 5, new Date(NOW.getTime() + 6000))).toBe(true);
  });
});

describe("private memories and profile (encrypted rows)", () => {
  it("remembers, recalls with usage counts, lists and forgets per user", async () => {
    const m = await remember(env, "alice", { kind: "goal", text: "Become a data analyst" });
    await remember(env, "alice", { kind: "goal", text: "Become a data analyst" });
    expect((await listMemories(env, "alice")).map((x) => x.uses)).toEqual([1]);
    expect((await recall(env, "alice", { query: "analyst" })).map((x) => x.text)).toEqual(["Become a data analyst"]);
    expect(await recall(env, "bob")).toEqual([]);
    expect(await forget(env, "bob", m.id)).toBe(false);
    expect(await forget(env, "alice", m.id)).toBe(true);
  });

  it("upserts the profile and deletes it", async () => {
    const profile = await updateProfile(env, "alice", { skills: [{ name: "SQL", source: "self-reported" }] });
    expect(profile.skills.map((s) => s.name)).toEqual(["SQL"]);
    expect((await getProfile(env, "alice")).skills.map((s) => s.name)).toEqual(["SQL"]);
    await updateProfile(env, "alice", { skills: [{ name: "Python", source: "resume" }] });
    expect((await getProfile(env, "alice")).skills.map((s) => s.name).sort()).toEqual(["Python", "SQL"]);
    expect(await deleteProfile(env, "alice")).toBe(true);
    expect(await deleteProfile(env, "alice")).toBe(false);
  });
});

describe("agent runs", () => {
  it("records and reads back a run for its owner only", async () => {
    const id = await recordRunStart(env, { userId: "alice", skill: "career-snapshot", platform: "app" });
    await recordRunDone(env, id, { summary: "ok" });
    expect((await findRun(env, id, "alice"))?.output).toEqual({ summary: "ok" });
    expect(await findRun(env, id, "bob")).toBeNull();
  });
});

describe("pairing", () => {
  it("offers a code, claims it once, then expires it", async () => {
    const offer = await offerCode(env, "alice", NOW);
    expect(offer.code).toMatch(/^\d{4}$/);
    expect(await offerStatus(env, "alice", offer.code, NOW)).toBe("waiting");
    expect(await claimCode(env, offer.code, NOW)).not.toBeNull();
    expect(await claimCode(env, offer.code, NOW)).toBeNull();
    expect(await offerStatus(env, "alice", offer.code, NOW)).toBe("claimed");
    expect(await deleteExpiredPairings(env, new Date(NOW.getTime() + 3 * 60_000))).toBe(1);
  });
});

describe("documents", () => {
  it("saves, reads, deletes and expires", async () => {
    const id = await saveDocument(env, "alice", { name: "cv.txt", format: "txt", text: "hello" }, NOW);
    expect((await readDocument(env, "alice", id, NOW))?.text).toBe("hello");
    expect(await readDocument(env, "bob", id, NOW)).toBeNull();
    expect(await deleteExpiredDocuments(env, new Date(NOW.getTime() + 2 * 3_600_000))).toBe(1);
    expect(await deleteDocument(env, "alice", id)).toBe(false);
  });
});

describe("voice sessions", () => {
  it("numbers turns inside the insert and scopes everything by user", async () => {
    const id = await createSession(env, "alice", { mode: "interview", companySlug: null, plan: { questions: [] } as never }, NOW);
    const score = { delivery: 1 } as never;
    await addTurn(env, "alice", id, { question: "q1", answer: "a1", score });
    await addTurn(env, "alice", id, { question: "q2", answer: "a2", score });
    expect((await listTurns(env, "alice", id)).map((t) => [t.idx, t.answer])).toEqual([
      [0, "a1"],
      [1, "a2"],
    ]);
    expect(await findSession(env, "bob", id)).toBeNull();
    expect(await countSessionsSince(env, "alice", new Date(NOW.getTime() - 1000))).toBe(1);
    await finishSession(env, "alice", id);
    expect((await findSession(env, "alice", id))?.status).toBe("finished");
    expect(await deleteOldSessions(env, new Date(NOW.getTime() + 31 * 86_400_000))).toBe(1);
    expect(await listTurns(env, "alice", id)).toEqual([]);
  });

  it("lets one draft rebuild run at a time and keeps it from going backwards", async () => {
    const id = await createSession(env, "alice", { mode: "interview", companySlug: null, plan: { questions: [] } as never }, NOW);
    expect(await claimDraftBuild(env, "alice", id, NOW)).toBe(true);
    expect(await claimDraftBuild(env, "alice", id, NOW)).toBe(false);
    expect(await claimDraftBuild(env, "bob", id, NOW)).toBe(false);
    // a claim left by a crashed rebuild expires
    expect(await claimDraftBuild(env, "alice", id, new Date(NOW.getTime() + 10 * 60_000))).toBe(true);

    await markDraftWanted(env, "alice", id);
    expect(await releaseDraftBuild(env, "alice", id)).toBe(false);
    await clearDraftWanted(env, "alice", id);
    await saveDraft(env, "alice", id, { overall: 70 }, 2);
    await saveDraft(env, "alice", id, { overall: 10 }, 1);
    expect(await releaseDraftBuild(env, "alice", id)).toBe(true);

    expect(await readDraft(env, "alice", id, NOW)).toEqual({ coversTurns: 2, raw: { overall: 70 }, pending: false });
    expect(await readDraft(env, "bob", id, NOW)).toEqual({ coversTurns: 0, raw: null, pending: false });
  });
});

describe("roadmap", () => {
  const step = (title: string) => ({ kind: "project", title, why: "w", detail: "d", estimate: "1 hr", label: "ready_now" }) as never;

  it("inserts steps once per position, tracks status with a note and counts progress", async () => {
    expect(await insertSteps(env, "alice", 0, [step("Read"), step("Build")], "template")).toBe(true);
    expect(await insertSteps(env, "alice", 0, [step("Read")], "template")).toBe(false);
    const [first] = await loadOpen(env, "alice", 0, 5);
    expect((await setStepStatus(env, "alice", first.id, "done", "built it"))?.status).toBe("done");
    expect(await setStepStatus(env, "bob", first.id, "done", undefined)).toBeNull();
    expect((await loadCompleted(env, "alice"))[0].note).toBe("built it");
    expect(await countSteps(env, "alice")).toEqual({ total: 2, done: 1, open: 1 });
    expect(await countSteps(env, "bob")).toEqual({ total: 0, done: 0, open: 0 });
  });
});

describe("feed", () => {
  it("claims a rebuild once, saves pages atomically and finds stale owners", async () => {
    expect(await claimRebuild(env, "alice", NOW)).toBe(true);
    expect(await claimRebuild(env, "alice", NOW)).toBe(false);
    await releaseClaim(env, "alice");
    expect(await claimRebuild(env, "alice", NOW)).toBe(true);
    const cards = Array.from({ length: 3 }, (_, i) => ({ id: `card${i}` }) as never);
    await saveFeed(env, "alice", { jobs: cards, events: [], hackathons: [], courses: [] } as never, NOW);
    const page = await readFeed(env, "alice", "jobs", 0, 2);
    expect(page.cards.length).toBe(2);
    expect(page.hasMore).toBe(true);
    expect(page.state.builtAt).toBe(NOW.toISOString());
    expect(isStale(page.state, NOW)).toBe(false);
    expect((await readFeed(env, "nobody", "jobs", 0, 2)).state.builtAt).toBeNull();
    expect(await staleFeedOwners(env, new Date(NOW.getTime() + 7 * 3_600_000), 10)).toEqual(["alice"]);
  });
});

describe("garbage collection", () => {
  it("runs every sweep on Postgres", async () => {
    await db.pg.exec("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')");
    await db.pg.exec("INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES ('old', 'c1', 'about', 'x', 'u', '2020-01-01', 'h')");
    await db.pg.exec("INSERT INTO cache (key, value, expires_at) VALUES ('k', 'v', '2020-01-01')");
    const deleteVectors = vi.spyOn(gcDeps, "deleteVectors").mockResolvedValue();
    expect(await collectGarbage(env, NOW)).toEqual({ privateDeleted: 0, factsDeleted: 1, cacheDeleted: 1, documentsDeleted: 0, pairingsDeleted: 0, headsetsDeleted: 0, launchesDeleted: 0, voiceSessionsDeleted: 0 });
    expect(deleteVectors).toHaveBeenCalledWith(env, ["fact:old"]);
  });
});

describe("job postings (encrypted rows)", () => {
  it("saves, finds and lists per user, and keeps the company slug readable", async () => {
    const content = {
      title: "Junior Data Analyst", company: "Acme", companySlug: "acme", location: null, seniority: null,
      requirements: [{ text: "SQL", topic: "SQL", required: true, have: true }], responsibilities: [], skills: ["SQL"], sourceUrl: null,
      prefilled: { targetRole: "Junior Data Analyst", company: null, steps: [] },
    };
    const saved = await savePosting(env, "alice", newPostingId(), content, NOW);
    expect(await findPosting(env, "alice", saved.id)).toEqual({ ...content, id: saved.id, createdAt: NOW.toISOString() });
    expect(await findPosting(env, "bob", saved.id)).toBeNull();
    expect((await listPostings(env, "alice")).map((p) => p.id)).toEqual([saved.id]);
    const { rows } = await db.pg.query<{ company_slug: string }>("SELECT company_slug FROM user_postings");
    expect(rows).toEqual([{ company_slug: "acme" }]);
  });
});
