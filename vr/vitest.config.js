import { defineConfig } from 'vitest/config'

// Separate from vite.config.js on purpose: that config carries the WebXR dev
// server setup, and vitest picks this file first so tests never boot it.
export default defineConfig({
  test: {
    environment: 'node', // lipSync and session are pure JS, no DOM needed
    include: ['src/**/*.test.js'],
  },
})
