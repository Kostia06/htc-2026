import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recapRouter } from "../../src/api/recap";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";
import { deps as experiences } from "../../src/memory/experiences";
import { deps as liveToken } from "../../src/voice/providers/gemini";
import { call, fakeDeps, fakeMemory, type FakeMemory } from "../agents/fakes";

const realLive = liveToken.fetch;
let tokenRequests: string[] = [];

beforeEach(async () => {
  tokenRequests = [];
  liveToken.fetch = (async (_url: RequestInfo, init?: RequestInit) => {
    tokenRequests.push(String(init?.body));
    return Response.json({ name: "auth_tokens/test" });
  }) as typeof fetch;
  vi.spyOn(experiences, "scrubNames").mockImplementation(async (_env, fields) => fields);
  vi.spyOn(experiences, "upsertVector").mockResolvedValue();
  await env.DB.prepare("DELETE FROM recap_voice_sessions").run();
  await env.DB.prepare("INSERT OR IGNORE INTO companies (id, slug, name) VALUES ('c1', 'atb', 'ATB Financial')").run();
});
afterEach(() => {
  liveToken.fetch = realLive;
});

const extracted = { company: "ATB", role: "Junior data analyst", round: "technical", questions: ["Explain a left join", "How would you find a slow query?"] };
const wrapUp = call("finish", {
  done: true,
  reply: "Got it: 2 questions from ATB's technical round. I'll share them anonymously.",
  extracted,
  note: "Interviewed at ATB, technical round, struggled with SQL joins",
});
const askCompany = call("finish", { done: false, reply: "Which company was it?", extracted: { questions: [] } });

function recapApp(replies = [wrapUp], memory: FakeMemory = fakeMemory()) {
  const app = new Hono<AppContext>();
  app.use("*", requireSession);
  const fakes = fakeDeps({ replies, memory });
  app.route("/", recapRouter(() => fakes.deps));
  return { app, ...fakes };
}

async function person() {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, id: (await verifySession(token, env.SESSION_SECRET))! };
}

const send = (app: Hono<AppContext>, token: string, path: string, body?: unknown) =>
  app.request(path, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }, env);

type Reply = { reply: string; done: boolean; extracted?: typeof extracted; shared?: boolean; error?: string };

const opening = { role: "raven", text: "How did your interview go?" };
const experienceRows = () => env.DB.prepare("SELECT role, questions_json, format FROM experiences").all<{ role: string; questions_json: string; format: string }>();

describe("POST /api/recap", () => {
  it("asks for the company when the story has none", async () => {
    const { app, conversations } = recapApp([askCompany]);
    const res = await send(app, (await person()).token, "/", { message: "It went okay, I was nervous.", history: [opening] });
    expect(res.status).toBe(200);
    expect(await res.json<Reply>()).toEqual({ reply: "Which company was it?", done: false });
    expect(conversations[0][0].parts[0].text).toContain("2 clarifying questions");
    expect((await experienceRows()).results).toHaveLength(0);
  });

  it("does not ask when the story is complete: shares the questions anonymously and keeps a private note", async () => {
    const memory = fakeMemory();
    const { app } = recapApp([wrapUp], memory);
    const me = await person();
    const res = await send(app, me.token, "/", {
      message: "ATB technical round, junior data analyst. They asked me to explain a left join and how I'd find a slow query. Email me at kostia@example.com",
      history: [opening],
    });
    expect(res.status).toBe(200);
    const body = await res.json<Reply>();
    expect(body).toMatchObject({ done: true, shared: true, extracted: { ...extracted, company: "ATB Financial" } });
    expect(body.reply).toBe("Got it: 2 questions from ATB's technical round. I'll share them anonymously.");

    const { results } = await experienceRows();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ role: "Junior data analyst", format: "technical" });
    expect(JSON.parse(results[0].questions_json)).toEqual(extracted.questions);
    expect(memory.items).toEqual([expect.objectContaining({ kind: "note", text: "Interviewed at ATB, technical round, struggled with SQL joins" })]);
  });

  it("uses the company the app already knows", async () => {
    const { app, conversations } = recapApp([call("finish", { done: true, reply: "Thanks!", extracted: { ...extracted, company: undefined } })]);
    const res = await send(app, (await person()).token, "/", { companySlug: "atb", message: "Technical round, junior analyst. They asked about joins.", history: [] });
    expect(await res.json<Reply>()).toMatchObject({ done: true, shared: true, extracted: { company: "ATB Financial" } });
    expect(conversations[0][0].parts[0].text).toContain("interviewed at ATB Financial");
    expect((await send(app, (await person()).token, "/", { companySlug: "nope", message: "hi", history: [] })).status).toBe(404);
  });

  it("stops asking after two clarifying questions", async () => {
    const { app, conversations } = recapApp([call("finish", { done: false, reply: "And the role?", extracted: { company: "ATB", questions: ["Explain a left join"] } })]);
    const history = [opening, { role: "user", text: "It went fine" }, { role: "raven", text: "Which company?" }, { role: "user", text: "ATB" }, { role: "raven", text: "What did they ask?" }];
    const res = await send(app, (await person()).token, "/", { message: "About left joins", history });
    const body = await res.json<Reply>();
    expect(body.done).toBe(true);
    expect(conversations[0][0].parts[0].text).toContain("no clarifying questions left");
    // no role: nothing usable for the public pool, so nothing is shared, and the reply says so
    expect(body.shared).toBe(false);
    expect(body.reply).toContain("kept a note for you");
    expect((await experienceRows()).results).toHaveLength(0);
  });

  it("keeps the recap private when the company is one we don't track", async () => {
    const { app } = recapApp([call("finish", { done: true, reply: "I'll share them.", extracted: { ...extracted, company: "Tiny Startup" } })]);
    const body = await (await send(app, (await person()).token, "/", { message: "Tiny Startup, analyst, asked about joins", history: [] })).json<Reply>();
    expect(body).toMatchObject({ done: true, shared: false, extracted: { company: "Tiny Startup" } });
    expect(body.reply).not.toContain("share");
  });

  it("rejects a turn without a message or with a malformed history", async () => {
    const { app } = recapApp();
    const token = (await person()).token;
    expect((await send(app, token, "/", { history: [] })).status).toBe(400);
    expect((await send(app, token, "/", { message: "hi", history: [{ role: "bot", text: "x" }] })).status).toBe(400);
    expect((await send(app, token, "/", { message: "hi", history: "nope" })).status).toBe(400);
  });

  it("answers 502 when the model never hands in a result", async () => {
    const { app } = recapApp([{ role: "model", parts: [{ text: "hmm" }] }]);
    expect((await send(app, (await person()).token, "/", { message: "hi", history: [] })).status).toBe(502);
  });
});

describe("POST /api/recap/voice", () => {
  const transcript = [
    { speaker: "interviewer", text: "How did your interview go?" },
    { speaker: "candidate", text: "ATB technical round for a junior data analyst, they asked about left joins and slow queries." },
  ];

  it("starts a recap call with recap instructions and the opening line", async () => {
    const { app } = recapApp();
    const res = await send(app, (await person()).token, "/voice", { companySlug: "atb" });
    expect(res.status).toBe(201);
    const body = await res.json<{ sessionId: string; opening: string; provider: string; credentials: { kind: string } }>();
    expect(body).toMatchObject({ provider: "gemini", credentials: { kind: "gemini-live" }, opening: "How did your interview go? Tell me like you'd tell a friend." });
    expect(body.sessionId).toBeTruthy();
    expect(tokenRequests[0]).toContain("at most two short clarifying questions");
    expect(tokenRequests[0]).toContain("ATB Financial");
  });

  it("reads the transcript like a typed recap, with no questions left, and shares it", async () => {
    const { app, conversations } = recapApp([wrapUp]);
    const me = await person();
    const { sessionId } = await (await send(app, me.token, "/voice", { companySlug: "atb" })).json<{ sessionId: string }>();
    const res = await send(app, me.token, `/voice/${sessionId}/finish`, { transcript });
    expect(res.status).toBe(200);
    expect(await res.json<Reply>()).toMatchObject({ done: true, shared: true, extracted: { company: "ATB Financial" } });
    expect(conversations[0][0].parts[0].text).toContain("no clarifying questions left");
    expect((await experienceRows()).results).toHaveLength(1);
    expect((await send(app, me.token, `/voice/${sessionId}/finish`, { transcript })).status).toBe(409);
  });

  it("only the owner can hand in a transcript", async () => {
    const { app } = recapApp();
    const me = await person();
    const { sessionId } = await (await send(app, me.token, "/voice", {})).json<{ sessionId: string }>();
    expect((await send(app, (await person()).token, `/voice/${sessionId}/finish`, { transcript })).status).toBe(404);
    expect((await send(app, me.token, "/voice/nope/finish", { transcript })).status).toBe(404);
  });

  it("rejects an empty or malformed transcript", async () => {
    const { app } = recapApp();
    const me = await person();
    const { sessionId } = await (await send(app, me.token, "/voice", {})).json<{ sessionId: string }>();
    expect((await send(app, me.token, `/voice/${sessionId}/finish`, { transcript: [transcript[0]] })).status).toBe(400);
    expect((await send(app, me.token, `/voice/${sessionId}/finish`, { transcript: [{ speaker: "ghost", text: "boo" }] })).status).toBe(400);
    expect((await send(app, me.token, `/voice/${sessionId}/finish`, {})).status).toBe(400);
  });
});
