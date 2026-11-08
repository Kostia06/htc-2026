import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deps } from "../../src/integrations/jev";
import { scoreTurn } from "../../src/voice/score";

const realFetch = deps.fetch;
afterEach(() => {
  deps.fetch = realFetch;
});

const jevReply = (scores: Record<string, number>) =>
  Response.json({ answers: Object.fromEntries(Object.entries(scores).map(([k, score]) => [k, { type: "score", score, confidence: 0.8 }])) });

const withKey = { ...env, JEV_API_KEY: "test-key" };

describe("scoreTurn", () => {
  it("scores an interview answer with Jev and points at the weakest part", async () => {
    const fetchMock = vi.fn(async () => jevReply({ structure: 1, relevance: 4, specificity: 3, confidence: 3 }));
    deps.fetch = fetchMock as unknown as typeof fetch;
    const result = await scoreTurn(withKey, { question: "Tell me about a project.", answer: "I built an API.", durationMs: 4000 });

    expect(result.scores).toEqual({ structure: 2, relevance: 5, specificity: 4, confidence: 4 });
    expect(result.tip).toMatch(/situation/i);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(Object.keys(body.questions)).toEqual(["structure", "relevance", "specificity", "confidence"]);
    expect(body.state.answer).toBe("I built an API.");
  });

  it("still returns delivery numbers when Jev is down", async () => {
    deps.fetch = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    const result = await scoreTurn(withKey, { question: "Q", answer: "Um, I, like, did it.", durationMs: 3000 });
    expect(result.scores).toEqual({});
    expect(result.delivery.fillerWords).toBe(2);
    expect(result.tip).toBeTruthy();
  });
});
