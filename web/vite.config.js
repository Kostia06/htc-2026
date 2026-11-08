import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// /api is proxied so the browser stays same-origin. API_PROXY_TARGET (web/.env.local) picks the Worker:
// the deployed one, or a local `cd server && pnpm dev` on port 8787 (the default).
// A production build talks to https://api.skillit.study directly instead (see VITE_API_BASE in lib/client.js).
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '')
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:8787'
  return {
    plugins: [react()],
    // in dev the landing server (5180) forwards /app and /api here, so the app lives under /app/;
    // the build is served from the root of app.skillit.study, where /app/assets would not exist
    base: env.APP_BASE || (command === 'build' ? '/' : '/app/'),
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': { target, changeOrigin: true, secure: true } } },
  }
})
