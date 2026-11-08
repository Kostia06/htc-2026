import { defineConfig } from "vitest/config";

// the Postgres adapter suite: plain Node, PGlite in memory, no Workers pool; run with `pnpm test:pg`
export default defineConfig({
  test: { include: ["test-pg/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 60_000 },
});
