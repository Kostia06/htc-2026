import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { voiceRouter } from "../../src/api/voice";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";
import { deps as jev } from "../../src/integrations/jev";
import { updateProfile } from "../../src/memory/profile/store";
import { newPostingId, savePosting } from "../../src/postings/store";
import { deps as followUpModel } from "../../src/voice/follow-up";
import { deps as liveToken } from "../../src/voice/providers/gemini";
import { profile } from "../voice/fixtures";

const realLive = liveToken.fetch;
const realJev = jev.fetch;
const realFollowUp = followUpModel.fetch;
let tokenRequests: string[] = [];

beforeEach(() => {
  tokenRequests = [];
  liveToken.fetch = (async (_url: RequestInfo, init?: RequestInit) => {
    tokenRequests.push(String(init?.body));
    return Response.json({ name: "auth_tokens/test" });
  }) as typeof fetch;
  jev.fetch = (async () =>
    Response.json({ answers: { structure: { type: "score", score: 2, confidence: 0.9 }, relevance: { type: "score", score: 3, confidence: 0.9 } } })) as typeof fetch;
});
afterEach(() => {
  liveToken.fetch = realLive;
  jev.fetch = realJev;
  followUpModel.fetch = realFollowUp;
  vi.unstubAllGlobals();
});

const debriefReply = {
  overall: 64,
  verdict: "Solid start.",
  strengths: [{ quote: "built an API", why: "concrete" }],
  improvements: [{ moment: "Q1", said: "I built an API.", better: "Add who used it.", example: "I built an API that 2,000 staff used daily." }],
  perQuestion: [{ question: "Q1", score: 64, oneLineFeedback: "Add the result." }],
  nextSteps: ["Add a number.", "Run it again."],
};

function voiceApp() {
  const app = new Hono<AppContext>();
  app.use("*", requireSession);
  app.route("/", voiceRouter());
  return app;
}

async function person() {
  const token = await issueSession(env.SESSION_SECRET);
  const id = (await verifySession(token, env.SESSION_SECRET))!;
  await updateProfile(env, id, profile);
  return { token, id };
}

const send = (app: Hono<AppContext>, token: string, method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, env);

type Started = { sessionId: string; mode: string; provider: string; credentials: { kind: string; token?: string; model?: string }; opening: string; questions?: { text: string; source: string }[] };

describe("/api/voice", () => {
  it("starts an interview with a locked live token and questions from the resume", async () => {
    const me = await person();
    const res = await send(voiceApp(), me.token, "POST", "/sessions", { mode: "interview" });
    expect(res.status).toBe(201);
    const body = await res.json<Started>();
    expect(body).toMatchObject({ mode: "interview", provider: "gemini", credentials: { kind: "gemini-live", token: "auth_tokens/test", model: env.GEMINI_LIVE_MODEL } });
    expect(body.questions?.some((q) => q.source === "resume")).toBe(true);
    expect(tokenRequests[0]).toContain("Junior data analyst");
  });

  it("only knows interviews: the retired networking mode is a bad request", async () => {
    const me = await person();
    const res = await send(voiceApp(), me.token, "POST", "/sessions", { mode: "networking" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "mode must be interview" });
  });

  it("scores each answer instantly and replays them only for their owner", async () => {
    const me = await person();
    const { sessionId } = await (await send(voiceApp(), me.token, "POST", "/sessions", { mode: "interview" })).json<Started>();
    const turn = await send(voiceApp(), me.token, "POST", `/sessions/${sessionId}/turns`, { question: "Q1", answer: "Um, I built an API.", durationMs: 3000 });
    expect(turn.status).toBe(200);
    expect(await turn.json()).toMatchObject({ scores: { structure: 3, relevance: 4 }, delivery: { fillerWords: 1 } });

    const replay = await (await send(voiceApp(), me.token, "GET", `/sessions/${sessionId}`)).json<{ turns: unknown[] }>();
    expect(replay.turns).toHaveLength(1);
    const stranger = await person();
    expect((await send(voiceApp(), stranger.token, "GET", `/sessions/${sessionId}`)).status).toBe(404);
  });

  it("finishes with a debrief and refuses more turns afterwards", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(debriefReply) }] } }] }));
    const me = await person();
    const { sessionId } = await (await send(voiceApp(), me.token, "POST", "/sessions", { mode: "interview" })).json<Started>();
    await send(voiceApp(), me.token, "POST", `/sessions/${sessionId}/turns`, { question: "Q1", answer: "I built an API that 2,000 staff used every day.", durationMs: 3000 });
    const finished = await send(voiceApp(), me.token, "POST", `/sessions/${sessionId}/finish`, {});
    expect(finished.status).toBe(200);
    expect(await finished.json()).toEqual(debriefReply);
    expect((await send(voiceApp(), me.token, "POST", `/sessions/${sessionId}/turns`, { question: "Q", answer: "A", durationMs: 1 })).status).toBe(409);
  });

  it("passes the chosen difficulty into the interviewer's instructions and rejects unknown ones", async () => {
    const me = await person();
    const hard = await send(voiceApp(), me.token, "POST", "/sessions", { mode: "interview", difficulty: "hard" });
    expect(hard.status).toBe(201);
    expect(tokenRequests.at(-1)).toMatch(/push back/i);
    expect((await send(voiceApp(), me.token, "POST", "/sessions", { mode: "interview", difficulty: "brutal" })).status).toBe(400);
  });

  it("takes the role, company and questions from a saved posting", async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')").run();
    const me = await person();
    const posting = await savePosting(env, me.id, newPostingId(), {
      title: "Junior Data Analyst",
      company: "Acme",
      companySlug: "acme",
      location: null,
      seniority: null,
      requirements: [{ text: "Kubernetes", topic: "Kubernetes", required: true, have: false }],
      responsibilities: ["Build dashboards for the lending team"],
      skills: [],
      sourceUrl: null,
      prefilled: { targetRole: null, company: null, steps: [] },
    });
    const res = await send(voiceApp(), me.token, "POST", "/sessions", { mode: "interview", postingId: posting.id, role: "ignored" });
    expect(res.status).toBe(201);
    const body = await res.json<Started & { role: string; company: string | null }>();
    expect(body).toMatchObject({ role: "Junior Data Analyst", company: "Acme" });
    expect(body.questions?.filter((q) => q.source === "posting").map((q) => q.text)).toEqual([
      "Here you'd build dashboards for the lending team. When have you done something like that?",
      "Kubernetes is on the posting. How would you get up to speed?",
    ]);
    expect(tokenRequests.at(-1)).toContain("Junior Data Analyst role at Acme");

    const stranger = await person();
    expect((await send(voiceApp(), stranger.token, "POST", "/sessions", { mode: "interview", postingId: posting.id })).status).toBe(404);
  });

  it("rejects bad input and too many sessions", async () => {
    const me = await person();
    expect((await send(voiceApp(), me.token, "POST", "/sessions", { mode: "karaoke" })).status).toBe(400);
    expect((await send(voiceApp(), me.token, "POST", "/sessions", { mode: "interview", companySlug: "nobody" })).status).toBe(404);
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await send(voiceApp(), me.token, "POST", "/sessions", { mode: "interview" })).status);
    expect(statuses.at(-1)).toBe(429);
  });

  it("says the next line for the owner only, at most once a second", async () => {
    followUpModel.fetch = (async () => Response.json({ candidates: [{ content: { parts: [{ text: "What was your part?" }] } }] })) as typeof fetch;
    jev.fetch = (async () => Response.json({ answers: { next: { type: "choice", choice: "follow_up", confidence: 0.9 } } })) as typeof fetch;
    const me = await person();
    const started = await (await send(voiceApp(), me.token, "POST", "/sessions", { mode: "interview" })).json<Started>();
    const first = started.questions?.[0]?.text ?? "";
    const answer = "I helped build it with the team.";
    const body = { answer, transcript: [{ speaker: "interviewer", text: first }, { speaker: "candidate", text: answer }] };

    const res = await send(voiceApp(), me.token, "POST", `/sessions/${started.sessionId}/next`, body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ say: "What was your part?", kind: "follow_up" });
    expect((await send(voiceApp(), me.token, "POST", `/sessions/${started.sessionId}/next`, body)).status).toBe(429);

    const stranger = await person();
    expect((await send(voiceApp(), stranger.token, "POST", `/sessions/${started.sessionId}/next`, body)).status).toBe(404);
  });

  it("rejects a malformed next-line request", async () => {
    const me = await person();
    const { sessionId } = await (await send(voiceApp(), me.token, "POST", "/sessions", { mode: "interview" })).json<Started>();
    const bad = [{}, { answer: "hi", transcript: "nope" }, { answer: "hi", transcript: [{ speaker: "robot", text: "x" }] }];
    for (const body of bad) expect((await send(voiceApp(), me.token, "POST", `/sessions/${sessionId}/next`, body)).status).toBe(400);
  });
});
