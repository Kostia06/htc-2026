import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deps as jev } from "../../src/integrations/jev";
import { deps as model, limits } from "../../src/voice/follow-up";
import { nextLine, type TranscriptLine } from "../../src/voice/next";
import { openingLine } from "../../src/voice/instructions";
import { buildInterviewPlan } from "../../src/voice/plan";
import { inputs } from "./fixtures";

const plan = buildInterviewPlan(inputs());
const [q1, q2] = plan.questions.map((q) => q.text);
const last = plan.questions.at(-1)?.text ?? "";
const VAGUE = "I helped with the API a bit.";

const realJev = jev.fetch;
const realModel = model.fetch;
const realTimeout = limits.timeoutMs;
let modelRequests: { url: string; body: Record<string, unknown> }[] = [];
let jevChoice = "follow_up";

const modelSays = (text: string) =>
  (async (url: RequestInfo, init?: RequestInit) => {
    modelRequests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Response.json({ candidates: [{ content: { role: "model", parts: [{ text }] } }] });
  }) as typeof fetch;

beforeEach(() => {
  modelRequests = [];
  jevChoice = "follow_up";
  jev.fetch = (async () => Response.json({ answers: { next: { type: "choice", choice: jevChoice, confidence: 0.9 } } })) as typeof fetch;
  model.fetch = modelSays("Nice. What was your part in it?");
});
afterEach(() => {
  jev.fetch = realJev;
  model.fetch = realModel;
  limits.timeoutMs = realTimeout;
});

const said = (...lines: [TranscriptLine["speaker"], string][]): TranscriptLine[] => lines.map(([speaker, text]) => ({ speaker, text }));

describe("next line", () => {
  it("moves from the opening straight to the first question", async () => {
    const transcript = said(["interviewer", openingLine(plan)], ["candidate", "Yeah, ready."]);
    expect(await nextLine(env, plan, { answer: "Yeah, ready.", transcript })).toEqual({ say: q1, kind: "question" });
    expect(modelRequests).toHaveLength(0);
  });

  it("asks one quick follow-up on a thin answer, written by the lite model with a tight limit", async () => {
    const transcript = said(["interviewer", q1], ["candidate", VAGUE]);
    expect(await nextLine(env, plan, { answer: VAGUE, transcript })).toEqual({ say: "Nice. What was your part in it?", kind: "follow_up" });
    expect(modelRequests[0].url).toContain(env.GEMINI_FALLBACK_MODEL);
    // thinkingBudget is rejected by the 3.x models with a 400; checked against the live API
    expect(modelRequests[0].body).toMatchObject({ generationConfig: { maxOutputTokens: expect.any(Number), thinkingConfig: { thinkingLevel: "minimal" } } });
    expect(JSON.stringify(modelRequests[0].body)).toContain(VAGUE);
  });

  it("never asks a second follow-up on the same question", async () => {
    const transcript = said(["interviewer", q1], ["candidate", VAGUE], ["interviewer", "What was your part?"], ["candidate", "Not much."]);
    expect(await nextLine(env, plan, { answer: "Not much.", transcript })).toEqual({ say: q2, kind: "question" });
  });

  it("moves on when Jev says the answer is complete", async () => {
    jevChoice = "move_on";
    const transcript = said(["interviewer", q1], ["candidate", VAGUE]);
    expect(await nextLine(env, plan, { answer: VAGUE, transcript })).toEqual({ say: q2, kind: "question" });
    expect(modelRequests).toHaveLength(0);
  });

  it("doesn't dig into a non-answer", async () => {
    const transcript = said(["interviewer", q1], ["candidate", "I don't know."]);
    expect((await nextLine(env, plan, { answer: "I don't know.", transcript })).kind).toBe("question");
  });

  it("wraps up after the last question", async () => {
    jevChoice = "move_on";
    const transcript = said(["interviewer", last], ["candidate", VAGUE]);
    expect((await nextLine(env, plan, { answer: VAGUE, transcript })).kind).toBe("wrap_up");
  });

  it("falls back to the next planned question when the model is slow", async () => {
    limits.timeoutMs = 50;
    model.fetch = ((_url: RequestInfo, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch;
    const started = Date.now();
    const transcript = said(["interviewer", q1], ["candidate", VAGUE]);
    expect(await nextLine(env, plan, { answer: VAGUE, transcript })).toEqual({ say: q2, kind: "question" });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("falls back when the model fails, and decides by heuristics when Jev is down", async () => {
    jev.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch;
    model.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    const transcript = said(["interviewer", q1], ["candidate", VAGUE]);
    expect(await nextLine(env, plan, { answer: VAGUE, transcript })).toEqual({ say: q2, kind: "question" });
  });

  it("keeps a rambling follow-up to twenty words", async () => {
    model.fetch = modelSays(`"${"really ".repeat(30)}interesting, what happened next?"\nSecond line`);
    const transcript = said(["interviewer", q1], ["candidate", VAGUE]);
    const line = await nextLine(env, plan, { answer: VAGUE, transcript });
    expect(line.kind).toBe("follow_up");
    expect(line.say.split(/\s+/).length).toBeLessThanOrEqual(20);
    expect(line.say).not.toContain('"');
  });
});
