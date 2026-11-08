import type { Env } from "../../env";

export type VoiceProviderName = "gemini" | "elevenlabs";

/** What a client needs to open the realtime voice connection itself. No long-lived key ever leaves the server. */
export type VoiceCredentials =
  | { kind: "gemini-live"; token: string; model: string }
  | {
      kind: "elevenlabs";
      // browser SDK (WebSocket)
      signedUrl: string;
      // Swift SDK (WebRTC); voice over the signed URL is not supported there
      conversationToken: string;
      // ElevenLabs takes the prompt from the client at connect time; the agent must allow these overrides
      overrides: { agent: { prompt: { prompt: string }; firstMessage: string } };
    };

export type StartedVoice = { provider: VoiceProviderName; credentials: VoiceCredentials; expiresAt: string | null };

export type VoiceProvider = {
  name: VoiceProviderName;
  startSession(env: Env, conversation: { mode: "interview" | "networking"; instructions: string; opening: string }, now?: Date): Promise<StartedVoice>;
};

export class ProviderNotConfigured extends Error {}
