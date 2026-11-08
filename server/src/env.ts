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
  ELEVENLABS_NETWORKING_AGENT_ID?: string;
  KEENABLE_API_KEY: string;
  // optional: without them job_postings reports "not configured"
  ADZUNA_APP_ID?: string;
  ADZUNA_APP_KEY?: string;
  // set: Supabase sign-in is on; missing: only the server's own tokens work
  SUPABASE_URL?: string;
  // defaults to "authenticated", the audience Supabase puts on signed-in users' tokens
  SUPABASE_JWT_AUDIENCE?: string;
  // comma-separated browser origins allowed to call /api/*; defaults to the local Vite dev server
  ALLOWED_ORIGINS?: string;
};

export type AppContext = { Bindings: Env; Variables: { sessionId: string } };
