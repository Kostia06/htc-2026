import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          SESSION_SECRET: "test-secret",
          MEMORY_SECRET: "test-memory-secret",
          // tests must never see the real keys in .dev.vars: a missed stub would spend real credits
          GEMINI_API_KEY: "test-gemini-key",
          JEV_API_KEY: "test-jev-key",
          KEENABLE_API_KEY: "test-keenable-key",
          ELEVENLABS_API_KEY: "",
          ELEVENLABS_AGENT_ID: "",
          VOICE_PROVIDER: "gemini",
          // production runs on Supabase; this suite runs on D1, and test-pg/ covers Postgres
          DB_BACKEND: "d1",
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
      },
    })),
  ],
  // test-pg/ runs under Node against PGlite (vitest.pg.config.ts), not in the Workers pool
  test: { setupFiles: ["./test/setup.ts"], include: ["test/**/*.test.ts"] },
});
