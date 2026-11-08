import { ProviderNotConfigured, type VoiceProvider } from "./types";

const SIGNED_URL = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url";
const TOKEN_URL = "https://api.elevenlabs.io/v1/convai/conversation/token";

export const deps = { fetch: (input: RequestInfo, init?: RequestInit) => fetch(input, init) };

async function getJson<T>(url: string, apiKey: string, what: string): Promise<T> {
  const res = await deps.fetch(url, { headers: { "xi-api-key": apiKey } });
  if (!res.ok) throw new Error(`elevenlabs ${what} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json<T>();
}

// The agent itself (voice, LLM) is set up in the ElevenLabs dashboard; per session we only hand the
// client its credentials plus the prompt overrides. The agent's Security settings must allow overriding
// the system prompt and first message, or ElevenLabs rejects the connection.
// Two credentials because the SDKs differ: the browser SDK (VR) talks over the signed WebSocket URL,
// while the Swift SDK only carries voice over WebRTC, which needs a conversation token.
export const elevenLabs: VoiceProvider = {
  name: "elevenlabs",
  async startSession(env, { mode, instructions, opening }) {
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_AGENT_ID) throw new ProviderNotConfigured("elevenlabs is not configured");
    // networking gets its own agent so the person at the meetup doesn't sound like the interviewer
    const agentId = (mode === "networking" && env.ELEVENLABS_NETWORKING_AGENT_ID) || env.ELEVENLABS_AGENT_ID;
    const agent = `agent_id=${encodeURIComponent(agentId)}`;
    const [signed, token] = await Promise.all([
      getJson<{ signed_url?: string }>(`${SIGNED_URL}?${agent}`, env.ELEVENLABS_API_KEY, "signed url"),
      getJson<{ token?: string }>(`${TOKEN_URL}?${agent}`, env.ELEVENLABS_API_KEY, "conversation token"),
    ]);
    if (!signed.signed_url) throw new Error("elevenlabs response had no signed_url");
    if (!token.token) throw new Error("elevenlabs response had no token");
    return {
      provider: "elevenlabs",
      credentials: {
        kind: "elevenlabs",
        signedUrl: signed.signed_url,
        conversationToken: token.token,
        overrides: { agent: { prompt: { prompt: instructions }, firstMessage: opening } },
      },
      // the responses carry no expiry, so we don't promise one
      expiresAt: null,
    };
  },
};
