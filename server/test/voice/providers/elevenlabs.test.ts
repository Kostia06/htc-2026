import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { voiceProvider } from "../../../src/voice/providers";
import { deps, elevenLabs } from "../../../src/voice/providers/elevenlabs";
import { ProviderNotConfigured } from "../../../src/voice/providers/types";

const realFetch = deps.fetch;
afterEach(() => {
  deps.fetch = realFetch;
});

const configured = { ...env, ELEVENLABS_API_KEY: "xi-test", ELEVENLABS_AGENT_ID: "agent_123" };

describe("elevenlabs provider", () => {
  it("refuses to start until its key and agent are set", async () => {
    await expect(elevenLabs.startSession({ ...env, ELEVENLABS_API_KEY: undefined }, { instructions: "x", opening: "Hi" })).rejects.toBeInstanceOf(
      ProviderNotConfigured,
    );
  });

  it("hands the client a signed url and the prompt to send as overrides", async () => {
    const fetchMock = vi.fn(async () => Response.json({ signed_url: "wss://api.elevenlabs.io/v1/convai/conversation?signature=s" }));
    deps.fetch = fetchMock as unknown as typeof fetch;
    const started = await elevenLabs.startSession(configured, { instructions: "Be Sam.", opening: "Hi! I'm Sam." });

    expect(started).toEqual({
      provider: "elevenlabs",
      credentials: {
        kind: "elevenlabs",
        signedUrl: "wss://api.elevenlabs.io/v1/convai/conversation?signature=s",
        overrides: { agent: { prompt: { prompt: "Be Sam." }, firstMessage: "Hi! I'm Sam." } },
      },
      expiresAt: null,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=agent_123");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("xi-test");
  });
});

describe("voiceProvider", () => {
  it("defaults to gemini and switches by config", () => {
    expect(voiceProvider({ ...env, VOICE_PROVIDER: undefined }).name).toBe("gemini");
    expect(voiceProvider({ ...env, VOICE_PROVIDER: "elevenlabs" }).name).toBe("elevenlabs");
    expect(() => voiceProvider({ ...env, VOICE_PROVIDER: "carrier-pigeon" })).toThrow(ProviderNotConfigured);
  });
});
