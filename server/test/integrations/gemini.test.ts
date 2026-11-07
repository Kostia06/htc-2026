import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generate, retry } from "../../src/integrations/gemini";

const reply = { candidates: [{ content: { role: "model", parts: [{ text: "hi" }] } }] };
const respond = (status: number) => new Response(status === 200 ? JSON.stringify(reply) : "{}", { status });

describe("generate", () => {
  afterEach(() => vi.unstubAllGlobals());
  retry.delaysMs = [0, 0];
  retry.timeoutMs = 45_000;

  it("retries a busy model and returns the answer once it recovers", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respond(503)).mockResolvedValueOnce(respond(429)).mockResolvedValueOnce(respond(200));
    vi.stubGlobal("fetch", fetchMock);
    expect(await generate(env, {})).toEqual(reply.candidates[0].content);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a request Gemini rejected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(400));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generate(env, {})).rejects.toThrow("gemini 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last retry when there is no fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(503));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generate({ ...env, GEMINI_FALLBACK_MODEL: undefined }, {})).rejects.toThrow("gemini 503");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("generate fallback", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("switches to the fallback model when the main one stays busy", async () => {
    const fetchMock = vi.fn(async (url: string) => respond(url.includes("fallback-model") ? 200 : 503));
    vi.stubGlobal("fetch", fetchMock);
    const content = await generate({ ...env, GEMINI_MODEL: "main-model", GEMINI_FALLBACK_MODEL: "fallback-model" }, {});
    expect(content).toEqual(reply.candidates[0].content);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("fallback-model");
  });

  it("treats a request that never answers as busy", async () => {
    retry.timeoutMs = 20;
    const hang = (_url: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError"))));
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => (url.includes("fallback-model") ? respond(200) : hang(url, init)));
    vi.stubGlobal("fetch", fetchMock);
    expect(await generate({ ...env, GEMINI_MODEL: "main-model", GEMINI_FALLBACK_MODEL: "fallback-model" }, {})).toEqual(reply.candidates[0].content);
  });
});
