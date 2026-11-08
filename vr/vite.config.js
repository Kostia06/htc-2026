import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

// Served over plain HTTP on purpose. WebXR needs a secure context, but enabling
// HTTPS here crashes Vite 8 on Node 22 the moment the HMR websocket upgrades
// (`server.shouldUpgradeCallback is not a function`). Reach the headset with
// `adb reverse` instead — localhost counts as secure. See QUEST.md.
//
// The Cloudflare plugin turns the build into the static-assets Worker that
// wrangler.jsonc deploys to vr.skillit.study.
export default defineConfig({
  plugins: [react(), cloudflare()],
  // a quick cloudflared tunnel is the other way to give the Quest HTTPS
  server: { host: true, port: 5173, allowedHosts: ['.trycloudflare.com'] },
})
