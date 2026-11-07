import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  // the Quest reaches the dev server through a quick cloudflared tunnel for HTTPS
  server: { allowedHosts: [".trycloudflare.com"] },
  test: { environment: "node" },
});