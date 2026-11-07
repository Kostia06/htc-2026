export type Env = {
  DB: D1Database;
  VECTORS: VectorizeIndex;
  AI: Ai;
  SESSION_SECRET: string;
  GEMINI_API_KEY: string;
  KEENABLE_API_KEY: string;
};

export type AppContext = { Bindings: Env; Variables: { sessionId: string } };
