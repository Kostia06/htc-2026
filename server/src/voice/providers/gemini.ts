import type { VoiceProvider } from "./types";

const TOKEN_URL = "https://generativelanguage.googleapis.com/v1beta/auth_tokens";
const SESSION_MINUTES = 30;
const START_WITHIN_MINUTES = 2;

export const deps = { fetch: (input: RequestInfo, init?: RequestInit) => fetch(input, init) };

const minutesAfter = (now: Date, minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

// One-use, short-lived, and locked to our model and instructions: a headset or phone holding it
// can only run this one conversation, never call Gemini with our key for anything else.
export const geminiLive: VoiceProvider = {
  name: "gemini",
  async startSession(env, { instructions }, now = new Date()) {
    const expiresAt = minutesAfter(now, SESSION_MINUTES);
    const res = await deps.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: minutesAfter(now, START_WITHIN_MINUTES),
        // the REST name for the SDKs' liveConnectConstraints; checked against the live API, which rejects the SDK name
        bidiGenerateContentSetup: {
          model: `models/${env.GEMINI_LIVE_MODEL}`,
          generationConfig: { responseModalities: ["AUDIO"] },
          systemInstruction: { parts: [{ text: instructions }] },
        },
      }),
    });
    if (!res.ok) throw new Error(`live token ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const { name } = await res.json<{ name?: string }>();
    if (!name) throw new Error("live token response had no name");
    return { provider: "gemini", credentials: { kind: "gemini-live", token: name, model: env.GEMINI_LIVE_MODEL }, expiresAt };
  },
};
