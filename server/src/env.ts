export type Env = {
  DB: D1Database;
  VECTORS: VectorizeIndex;
  AI: Ai;
  SESSION_SECRET: string;
  MEMORY_SECRET: string;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  GEMINI_FALLBACK_MODEL?: string;
  KEENABLE_API_KEY: string;
  // optional: without them job_postings reports "not configured"
  ADZUNA_APP_ID?: string;
  ADZUNA_APP_KEY?: string;
  // both set: Auth0 sign-in is on; either missing: only the server's own tokens work
  AUTH0_DOMAIN?: string;
  AUTH0_AUDIENCE?: string;
};

export type AppContext = { Bindings: Env; Variables: { sessionId: string } };
