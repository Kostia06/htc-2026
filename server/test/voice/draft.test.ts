import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { draftTiming, finalReport, latestDraft, refreshDraft } from "../../src/voice/draft";
import { buildInterviewPlan } from "../../src/voice/plan";
import { addTurn, createSession, findSession, listTurns } from "../../src/voice/store";
import { inputs } from "./fixtures";

const plan = buildInterviewPlan(inputs());
const score = { scores: { structure: 3 }, delivery: { words: 9, fillerWords: 0, wordsPerMinute: 120 }, tip: "Add a number." };
const ANSWER = "I built an API that two thousand staff used every day.";

const reply = (overall: number, questions: number) => ({
  overall,
  verdict: "Solid.",
  strengths: [{ quote: "built an API", why: "concrete" }],
  improvements: [{ moment: "Q1", said: "I built an API.", better: "Say who used it.", example: "It served 2,000 staff." }],
  perQuestion: Array.from({ length: questions }, (_, i) => ({ question: `Q${i + 1}`, score: overall, oneLineFeedback: "Add the result." })),
  nextSteps: ["Add a number."],
});
const gemini = (body: unknown) => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] });

// answers the debrief prompt with a reply covering however many exchanges the prompt lists
function stubModel(calls: string[], overall = 60) {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push(String(url));
    const questions = (String(init.body).match(/They were asked:/g) ?? []).length;
    return gemini(reply(overall, questions));
  });
}

async function sessionWith(answers: string[]) {
  const id = await createSession(env, "owner", { mode: "interview", companySlug: null, plan });
  for (const [i, answer] of answers.entries()) await addTurn(env, "owner", id, { question: `Q${i + 1}`, answer, score });
  return (await findSession(env, "owner", id))!;
}

afterEach(() => {
  vi.unstubAllGlobals();
  draftTiming.waitMs = 4000;
});

describe("live draft report", () => {
  it("builds a draft with the lite model and keeps it only as ciphertext", async () => {
    const calls: string[] = [];
    stubModel(calls);
    const session = await sessionWith([ANSWER]);
    await refreshDraft(env, "owner", session);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(`/${env.GEMINI_FALLBACK_MODEL}:`);
    expect(await latestDraft(env, "owner", session.id)).toMatchObject({ coversTurns: 1, totalTurns: 1, report: { overall: 60 } });
    const row = await env.DB.prepare("SELECT draft_ciphertext FROM voice_sessions WHERE id = ?").bind(session.id).first<{ draft_ciphertext: string }>();
    expect(row?.draft_ciphertext).not.toContain("Solid");
    expect(await latestDraft(env, "stranger", session.id)).toBeNull();
  });

  it("never runs two model calls at once: turns that land mid-build get one more round, not one each", async () => {
    let releaseFirst!: () => void;
    let firstStarted!: () => void;
    const started = new Promise<void>((resolve) => (firstStarted = resolve));
    const gate = new Promise<void>((resolve) => (releaseFirst = resolve));
    const calls: number[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const questions = (String(init.body).match(/They were asked:/g) ?? []).length;
      calls.push(questions);
      if (calls.length === 1) {
        firstStarted();
        await gate;
      }
      return gemini(reply(60, questions));
    });
    const session = await sessionWith([ANSWER]);
    const first = refreshDraft(env, "owner", session);
    await started;
    await addTurn(env, "owner", session.id, { question: "Q2", answer: ANSWER, score });
    await refreshDraft(env, "owner", session);
    await addTurn(env, "owner", session.id, { question: "Q3", answer: ANSWER, score });
    await refreshDraft(env, "owner", session);
    releaseFirst();
    await first;

    expect(calls).toEqual([1, 3]);
    expect(await latestDraft(env, "owner", session.id)).toMatchObject({ coversTurns: 3, totalTurns: 3 });
  });

  it("keeps no draft when the model fails, rather than a scores-only one", async () => {
    vi.stubGlobal("fetch", async () => new Response("bad", { status: 500 }));
    const session = await sessionWith([ANSWER]);
    await refreshDraft(env, "owner", session);
    expect(await latestDraft(env, "owner", session.id)).toBeNull();
  });

  it("finishes from a draft that covers every turn without another model call, with the same caps as ever", async () => {
    const calls: string[] = [];
    stubModel(calls, 90);
    const session = await sessionWith(["yeah"]);
    await refreshDraft(env, "owner", session);
    const report = await finalReport(env, "owner", session, await listTurns(env, "owner", session.id));

    expect(calls).toHaveLength(1);
    // a non-answer is capped at 5 and the overall at mean + 5, whatever the model said
    expect(report.perQuestion[0].score).toBe(5);
    expect(report.overall).toBe(10);
  });

  it("builds the report now, with the main model, when the draft is missing a turn", async () => {
    const calls: string[] = [];
    stubModel(calls);
    const session = await sessionWith([ANSWER]);
    await refreshDraft(env, "owner", session);
    await addTurn(env, "owner", session.id, { question: "Q2", answer: ANSWER, score });
    const report = await finalReport(env, "owner", session, await listTurns(env, "owner", session.id));

    expect(report.perQuestion).toHaveLength(2);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain(`/${env.GEMINI_MODEL}:`);
  });

  it("waits for a rebuild in flight instead of starting a second one", async () => {
    let release!: () => void;
    let modelCalled!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const called = new Promise<void>((resolve) => (modelCalled = resolve));
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push(String(url));
      modelCalled();
      await gate;
      return gemini(reply(70, (String(init.body).match(/They were asked:/g) ?? []).length));
    });
    const session = await sessionWith([ANSWER]);
    const building = refreshDraft(env, "owner", session);
    await called;
    const finishing = finalReport(env, "owner", session, await listTurns(env, "owner", session.id));
    setTimeout(release, 300);
    const [report] = await Promise.all([finishing, building]);

    expect(calls).toHaveLength(1);
    expect(report.overall).toBe(70);
  });

  it("stops waiting on a slow rebuild and builds the report itself", async () => {
    draftTiming.waitMs = 200;
    let release!: () => void;
    let modelCalled!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const called = new Promise<void>((resolve) => (modelCalled = resolve));
    let calls = 0;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        modelCalled();
        await gate;
      }
      return gemini(reply(40, (String(init.body).match(/They were asked:/g) ?? []).length));
    });
    const session = await sessionWith([ANSWER]);
    const building = refreshDraft(env, "owner", session);
    await called;
    const report = await finalReport(env, "owner", session, await listTurns(env, "owner", session.id));
    release();
    await building;

    expect(calls).toBe(2);
    expect(report.overall).toBe(40);
  });
});
