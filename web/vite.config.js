import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// /api is proxied so the browser stays same-origin. API_PROXY_TARGET (web/.env.local) picks the Worker:
// the deployed one, or a local `cd server && pnpm dev` on port 8787 (the default).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://localhost:8787'
  return {
    plugins: [react()],
    // the app lives under /app/; in dev the landing server (5180) forwards /app and /api here
    base: '/app/',
    server: { port: 5173, strictPort: true, proxy: { '/api': { target, changeOrigin: true, secure: true } } },
  }
})
