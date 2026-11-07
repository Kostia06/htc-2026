import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generate, retry } from "../../src/integrations/gemini";

const reply = { candidates: [{ content: { role: "model", parts: [{ text: "hi" }] } }] };
const respond = (status: number) => new Response(status === 200 ? JSON.stringify(reply) : "{}", { status });
const answer = reply.candidates[0].content;

const withFallback = { ...env, GEMINI_MODEL: "main-model", GEMINI_FALLBACK_MODEL: "fallback-model" };
const noFallback = { ...env, GEMINI_MODEL: "main-model", GEMINI_FALLBACK_MODEL: undefined };

function serve(byModel: (model: "main" | "fallback", init: RequestInit) => Promise<Response> | Response) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => byModel(url.includes("fallback-model") ? "fallback" : "main", init));
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, callsTo: (model: string) => fetchMock.mock.calls.filter(([url]) => url.includes(`${model}-model`)).length };
}

const hang = (init: RequestInit) =>
  new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError"))));

describe("generate", () => {
  beforeEach(() => {
    retry.delaysMs = [0, 0];
    retry.timeoutMs = 20;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("retries an overloaded model and returns the answer once it recovers", async () => {
    const statuses = [503, 503, 200];
    const { callsTo } = serve(() => respond(statuses.shift() ?? 200));
    expect(await generate(noFallback, {})).toEqual(answer);
    expect(callsTo("main")).toBe(3);
  });

  it("does not retry a request Gemini rejected", async () => {
    const { fetchMock } = serve(() => respond(400));
    await expect(generate(withFallback, {})).rejects.toThrow("gemini 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last retry when there is no fallback", async () => {
    const { callsTo } = serve(() => respond(503));
    await expect(generate(noFallback, {})).rejects.toThrow("gemini 503");
    expect(callsTo("main")).toBe(3);
  });

  it("moves to the fallback once the main model stays overloaded", async () => {
    const { callsTo } = serve((model) => respond(model === "fallback" ? 200 : 503));
    expect(await generate(withFallback, {})).toEqual(answer);
    expect(callsTo("fallback")).toBe(1);
  });

  // retrying the same model only burns more of a spent quota
  it("goes straight to the fallback when the quota is used up", async () => {
    const { callsTo } = serve((model) => respond(model === "fallback" ? 200 : 429));
    expect(await generate(withFallback, {})).toEqual(answer);
    expect(callsTo("main")).toBe(1);
  });

  // a slow model is usually slow again on retry; waiting through three timeouts is what made runs hang
  it("goes straight to the fallback when the main model times out", async () => {
    const { callsTo } = serve((model, init) => (model === "fallback" ? respond(200) : hang(init)));
    expect(await generate(withFallback, {})).toEqual(answer);
    expect(callsTo("main")).toBe(1);
  });
});
