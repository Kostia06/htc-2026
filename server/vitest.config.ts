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
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
      },
    })),
  ],
  test: { setupFiles: ["./test/setup.ts"] },
});
