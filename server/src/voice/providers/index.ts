import type { Env } from "../../env";
import { elevenLabs } from "./elevenlabs";
import { geminiLive } from "./gemini";
import { ProviderNotConfigured, type VoiceProvider } from "./types";

const PROVIDERS: Record<string, VoiceProvider> = { gemini: geminiLive, elevenlabs: elevenLabs };

/** Picked by VOICE_PROVIDER so switching vendors is a config change, not a code change. Scoring stays on Jev either way. */
export function voiceProvider(env: Env): VoiceProvider {
  const provider = PROVIDERS[env.VOICE_PROVIDER ?? "gemini"];
  if (!provider) throw new ProviderNotConfigured(`unknown voice provider "${env.VOICE_PROVIDER}"`);
  return provider;
}

export { ProviderNotConfigured } from "./types";
export type { StartedVoice, VoiceCredentials } from "./types";
