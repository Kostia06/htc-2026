import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDebrief, fallbackDebrief, normalizeDebrief, turnScore } from "../../src/voice/debrief";
import { buildInterviewPlan, buildNetworkingPlan } from "../../src/voice/plan";
import type { StoredTurn } from "../../src/voice/store";
import { inputs } from "./fixtures";

const turn = (over: Partial<StoredTurn> = {}): StoredTurn => ({
  idx: 0,
  question: "Tell me about a project you're proud of.",
  answer: "I built a Flask API for 2,000 internal users. It cut report time in half.",
  scores: { structure: 4, relevance: 5, specificity: 3 },
  delivery: { words: 15, fillerWords: 0, wordsPerMinute: 140 },
  tip: "Add one concrete detail.",
  ...over,
});

const modelReply = {
  overall: 72,
  verdict: "Clear and concrete, a little short on results.",
  strengths: [{ quote: "2,000 internal users", why: "A number makes the scale real." }],
  improvements: [{ moment: "the project question", said: "cut report time in half", better: "Say what that meant for the team.", example: "Reports that took a day now take an afternoon." }],
  perQuestion: [{ question: "ignored by server", score: 72, oneLineFeedback: "Good scale, add the outcome." }],
  nextSteps: ["Write one result sentence per project.", "Say it out loud once."],
};

function serveModel(body: unknown, status = 200) {
  const prompts: string[] = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const sent = JSON.parse(String(init.body)) as { contents: { parts: { text: string }[] }[] };
    prompts.push(sent.contents[0].parts[0].text);
    return status === 200 ? Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }) : new Response("nope", { status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, prompts };
}

afterEach(() => vi.unstubAllGlobals());

describe("buildDebrief", () => {
  it("makes one model call with the transcript and Jev scores, and returns the full debrief shape", async () => {
    const { fetchMock, prompts } = serveModel(modelReply);
    const debrief = await buildDebrief(env, buildInterviewPlan(inputs()), [turn()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prompts[0]).toContain("<answer>I built a Flask API");
    expect(prompts[0]).toContain("structure 4/5");
    expect(prompts[0]).toContain("Junior data analyst");
    expect(debrief).toEqual({
      ...modelReply,
      perQuestion: [{ question: "Tell me about a project you're proud of.", score: 72, oneLineFeedback: "Good scale, add the outcome." }],
    });
  });

  it("judges networking on the four moves, not interview structure", async () => {
    const { prompts } = serveModel(modelReply);
    await buildDebrief(env, buildNetworkingPlan(inputs()), [turn()]);
    expect(prompts[0]).toMatch(/introduce themselves/i);
    expect(prompts[0]).toMatch(/ask to stay in touch/i);
    expect(prompts[0]).not.toMatch(/mock interview/i);
  });

  it("still returns a debrief from the scores when the model is down", async () => {
    serveModel(null, 400);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const debrief = await buildDebrief(env, buildInterviewPlan(inputs()), [turn(), turn({ idx: 1, question: "Q2", scores: { structure: 1 } })]);
    expect(debrief.overall).toBe(Math.round((80 + 20) / 2));
    expect(debrief.perQuestion.map((q) => q.score)).toEqual([80, 20]);
    expect(debrief.improvements[0].moment).toBe("Q2");
    expect(warn).toHaveBeenCalled();
  });
});

describe("normalizeDebrief", () => {
  it("clamps scores, keeps the server's questions and caps the lists", () => {
    const turns = [turn(), turn({ idx: 1, question: "Q2", scores: {} })];
    const debrief = normalizeDebrief(
      {
        overall: 140,
        verdict: "  ok ",
        strengths: [{ quote: "a", why: "b" }, { quote: "c", why: "d" }, { quote: "e", why: "f" }, { quote: "too many", why: "" }],
        improvements: "not a list",
        perQuestion: [{ question: "wrong", score: -5, oneLineFeedback: "fine" }],
        nextSteps: ["one", "", "two", "three"],
      },
      turns,
    );
    expect(debrief.overall).toBe(100);
    expect(debrief.verdict).toBe("ok");
    expect(debrief.strengths).toHaveLength(3);
    expect(debrief.improvements).toEqual(fallbackDebrief(turns).improvements);
    expect(debrief.perQuestion).toEqual([
      { question: "Tell me about a project you're proud of.", score: 0, oneLineFeedback: "fine" },
      { question: "Q2", score: 50, oneLineFeedback: "Add one concrete detail." },
    ]);
    expect(debrief.nextSteps).toEqual(["one", "two"]);
  });

  it("scores a turn out of 100 from the Jev dimensions", () => {
    expect(turnScore({ scores: { a: 5, b: 3 } })).toBe(80);
    expect(turnScore({ scores: {} })).toBeNull();
  });
});
