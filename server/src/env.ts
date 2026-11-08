export type Env = {
  DB: D1Database;
  VECTORS: VectorizeIndex;
  // "d1" (default) or "postgres": which store db() and vectors() talk to; see README "Database: Supabase"
  DB_BACKEND?: string;
  // Postgres backend only: the Hyperdrive binding in production, or a plain connection string for local dev
  HYPERDRIVE?: Hyperdrive;
  SUPABASE_DB_URL?: string;
  // set: POST /admin/reembed-vectors (bearer) rebuilds the vector index from the fact tables; missing: the route is a 404
  ADMIN_SECRET?: string;
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
  // set: Supabase sign-in is on; missing: only the server's own tokens work
  SUPABASE_URL?: string;
  // defaults to "authenticated", the audience Supabase puts on signed-in users' tokens
  SUPABASE_JWT_AUDIENCE?: string;
  // comma-separated browser origins allowed to call /api/*; defaults to the local Vite dev server
  ALLOWED_ORIGINS?: string;
  // all three set: the cron and the generator push to iOS through APNs; any missing: push is off, apps poll instead
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  // the .p8 file's contents (PEM, or just its base64 body)
  APNS_PRIVATE_KEY?: string;
  // defaults to com.kostiailn.skillit
  APNS_TOPIC?: string;
  // "sandbox" (default, for Xcode builds) or "production" (TestFlight and App Store)
  APNS_ENV?: string;
};

export type AppContext = { Bindings: Env; Variables: { sessionId: string } };
