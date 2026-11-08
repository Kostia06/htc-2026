# vr

Skillit in the Meta Quest Browser: sign in by typing the 4-digit code from the phone app, then practice scenes (WebXR, coming next).

- Install and run: `pnpm install && pnpm dev` (API at `VITE_RAVEN_API_URL`, default `http://localhost:8799`; tests: `pnpm test`).
- Run the Worker in `server/` with `pnpm dev --port 8799`; it allows CORS from origins in `ALLOWED_ORIGINS` (default `http://localhost:5173`).
- On a Quest: run `pnpm dev --host`, then `cloudflared tunnel --url http://localhost:5173` for an HTTPS URL. Mic and WebXR need HTTPS.
- Tunnel the API too (`cloudflared tunnel --url http://localhost:8799`), set `VITE_RAVEN_API_URL` to that URL, and add the page's tunnel URL to `ALLOWED_ORIGINS` in `server/.dev.vars`.
- `vite.config.ts` already accepts `*.trycloudflare.com` hosts; add a named tunnel's host there if you use one.
- Open the tunnel URL in the Quest Browser, enter the code the Skillit app on your phone shows (Practice, then Practice in VR).

## Deploy

`pnpm run deploy` builds and uploads the static site to https://raven-vr.ilnkostia-dev.workers.dev. The API address comes from `.env.production`; the API only accepts browser calls from origins listed in `ALLOWED_ORIGINS` in `server/wrangler.jsonc`.
