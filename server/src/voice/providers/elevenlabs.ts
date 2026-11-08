import { ProviderNotConfigured, type VoiceProvider } from "./types";

const SIGNED_URL = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url";

export const deps = { fetch: (input: RequestInfo, init?: RequestInit) => fetch(input, init) };

// The agent itself (voice, LLM) is set up in the ElevenLabs dashboard; per session we only hand the
// client a signed URL plus the prompt overrides. The agent's Security settings must allow overriding
// the system prompt and first message, or ElevenLabs rejects the connection.
export const elevenLabs: VoiceProvider = {
  name: "elevenlabs",
  async startSession(env, { mode, instructions, opening }) {
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_AGENT_ID) throw new ProviderNotConfigured("elevenlabs is not configured");
    // networking gets its own agent so the person at the meetup doesn't sound like the interviewer
    const agentId = (mode === "networking" && env.ELEVENLABS_NETWORKING_AGENT_ID) || env.ELEVENLABS_AGENT_ID;
    const url = `${SIGNED_URL}?agent_id=${encodeURIComponent(agentId)}`;
    const res = await deps.fetch(url, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
    if (!res.ok) throw new Error(`elevenlabs signed url ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const { signed_url } = await res.json<{ signed_url?: string }>();
    if (!signed_url) throw new Error("elevenlabs response had no signed_url");
    return {
      provider: "elevenlabs",
      credentials: { kind: "elevenlabs", signedUrl: signed_url, overrides: { agent: { prompt: { prompt: instructions }, firstMessage: opening } } },
      // the response carries no expiry, so we don't promise one
      expiresAt: null,
    };
  },
};
