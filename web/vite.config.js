import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// /api goes to the Worker (`cd server && pnpm dev`, port 8787) so the browser stays same-origin.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
