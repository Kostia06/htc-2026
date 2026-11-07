import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deps, geminiLive } from "../../../src/voice/providers/gemini";

const realFetch = deps.fetch;
afterEach(() => {
  deps.fetch = realFetch;
});

describe("gemini live provider", () => {
  it("asks for a one-use token locked to the live model and our instructions", async () => {
    const fetchMock = vi.fn(async () => Response.json({ name: "auth_tokens/abc" }));
    deps.fetch = fetchMock as unknown as typeof fetch;
    const now = new Date("2026-11-08T10:00:00Z");
    const started = await geminiLive.startSession(env, { instructions: "Be the interviewer.", opening: "Hi" }, now);

    expect(started).toEqual({
      provider: "gemini",
      credentials: { kind: "gemini-live", token: "auth_tokens/abc", model: env.GEMINI_LIVE_MODEL },
      expiresAt: "2026-11-08T10:30:00.000Z",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/auth_tokens");
    expect(JSON.parse(String(init.body))).toMatchObject({
      uses: 1,
      expireTime: "2026-11-08T10:30:00.000Z",
      newSessionExpireTime: "2026-11-08T10:02:00.000Z",
      bidiGenerateContentSetup: {
        model: `models/${env.GEMINI_LIVE_MODEL}`,
        generationConfig: { responseModalities: ["AUDIO"] },
        systemInstruction: { parts: [{ text: "Be the interviewer." }] },
      },
    });
  });

  it("fails loudly when Google refuses", async () => {
    deps.fetch = (async () => new Response("quota", { status: 429 })) as unknown as typeof fetch;
    await expect(geminiLive.startSession(env, { instructions: "x", opening: "Hi" })).rejects.toThrow("live token 429");
  });
});
