export type Env = {
  DB: D1Database;
  VECTORS: VectorizeIndex;
  AI: Ai;
  SESSION_SECRET: string;
  MEMORY_SECRET: string;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  GEMINI_FALLBACK_MODEL?: string;
  GEMINI_LIVE_MODEL: string;
  // optional: without it, live scoring falls back to delivery numbers only
  JEV_API_KEY?: string;
  // "gemini" (default) or "elevenlabs"; ElevenLabs also needs its key and agent id
  VOICE_PROVIDER?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_AGENT_ID?: string;
  KEENABLE_API_KEY: string;
  // optional: without them job_postings reports "not configured"
  ADZUNA_APP_ID?: string;
  ADZUNA_APP_KEY?: string;
  // both set: Auth0 sign-in is on; either missing: only the server's own tokens work
  AUTH0_DOMAIN?: string;
  AUTH0_AUDIENCE?: string;
};

export type AppContext = { Bindings: Env; Variables: { sessionId: string } };
