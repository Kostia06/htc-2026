import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { voiceHistory } from "../../src/api/voice-history";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";
import { addTurn, createSession, finishSession } from "../../src/voice/store";
import type { InterviewPlan } from "../../src/voice/types";

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.route("/", voiceHistory);

type Person = { token: string; id: string };
type Listed = { id: string; mode: string; companySlug: string | null; companyName: string | null; status: string; createdAt: string; finishedAt: string | null; score: number | null; turnCount: number };
type Page = { sessions: Listed[]; nextCursor: string | null };

const plan: InterviewPlan = { mode: "interview", role: "Developer", company: null, questions: [] };
const delivery = { words: 10, fillerWords: 0, wordsPerMinute: 120 };

async function person(): Promise<Person> {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, id: (await verifySession(token, env.SESSION_SECRET))! };
}

async function get(who: Person, path = "/") {
  const res = await app.request(path, { headers: { Authorization: `Bearer ${who.token}` } }, env);
  return { status: res.status, body: await res.json<Page>() };
}

const at = (hoursAgo: number) => new Date(Date.parse("2026-11-07T12:00:00.000Z") - hoursAgo * 3600_000);

describe("GET /api/voice/history", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM voice_turns"),
      env.DB.prepare("DELETE FROM voice_sessions"),
      env.DB.prepare("INSERT OR IGNORE INTO companies (id, slug, name) VALUES ('c1', 'atb', 'ATB Financial')"),
    ]);
  });

  it("lists my sessions newest first with the company name and an average score", async () => {
    const me = await person();
    const older = await createSession(env, me.id, { mode: "interview", companySlug: "atb", plan }, at(5));
    await addTurn(env, me.id, older, { question: "Q1", answer: "A1", score: { scores: { structure: 4, relevance: 2 }, delivery, tip: "t" } });
    await addTurn(env, me.id, older, { question: "Q2", answer: "A2", score: { scores: { structure: 3 }, delivery, tip: "t" } });
    await finishSession(env, me.id, older);
    const newer = await createSession(env, me.id, { mode: "interview", companySlug: null, plan }, at(1));

    const { status, body } = await get(me);
    expect(status).toBe(200);
    expect(body.nextCursor).toBeNull();
    expect(body.sessions.map((s) => s.id)).toEqual([newer, older]);
    const [fresh, done] = body.sessions;
    expect(fresh).toMatchObject({ mode: "interview", companySlug: null, companyName: null, status: "active", score: null, turnCount: 0 });
    expect(done).toMatchObject({ mode: "interview", companySlug: "atb", companyName: "ATB Financial", status: "finished", score: 3, turnCount: 2 });
    expect(done.finishedAt).not.toBeNull();
  });

  it("never shows someone else's sessions", async () => {
    const me = await person();
    const other = await person();
    await createSession(env, other.id, { mode: "interview", companySlug: null, plan }, at(1));

    const { body } = await get(me);
    expect(body.sessions).toEqual([]);
  });

  it("pages with a cursor", async () => {
    const me = await person();
    for (let i = 0; i < 25; i++) await createSession(env, me.id, { mode: "interview", companySlug: null, plan }, at(i));

    const first = await get(me);
    expect(first.body.sessions).toHaveLength(20);
    expect(first.body.nextCursor).not.toBeNull();

    const second = await get(me, `/?cursor=${encodeURIComponent(first.body.nextCursor!)}`);
    expect(second.body.sessions).toHaveLength(5);
    expect(second.body.nextCursor).toBeNull();
    const seen = new Set([...first.body.sessions, ...second.body.sessions].map((s) => s.id));
    expect(seen.size).toBe(25);
  });

  it("rejects requests without a session", async () => {
    expect((await app.request("/", {}, env)).status).toBe(401);
  });
});
