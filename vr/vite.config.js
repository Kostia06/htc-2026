import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served over plain HTTP on purpose. WebXR needs a secure context, but enabling
// HTTPS here crashes Vite 8 on Node 22 the moment the HMR websocket upgrades
// (`server.shouldUpgradeCallback is not a function`). Reach the headset with
// `adb reverse` instead — localhost counts as secure. See QUEST.md.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
})
