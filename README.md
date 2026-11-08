# AI Mentor (working name)

Hack the Change 2026, Prompt 2: helping people build in-demand skills and networks in a changing job market.

Practice the interview before the interview. A VR interviewer on Meta Quest asks you the questions people were actually asked at a Calgary company, scores every answer and shows you what a stronger one sounds like. Around it: a roadmap map built from real Calgary labour data, and an anonymous interview memory that an AI research agent keeps up to date.

## Layout

- `server/`: Cloudflare Worker (TypeScript): API, research agent with memory and tools
- `web/`: React web app (Vite)
- `vr/`: WebXR interview scene for Meta Quest 3
- `ios/`: SwiftUI app
- `scripts/`: data ingest and seeding
- `docs/`: design, plan, AI usage

See `CONTRIBUTING.md` for branches and rules.

## Running the server locally

```bash
cd server
pnpm install
cp ../.env.example .dev.vars   # fill in keys
pnpm dev
```

## Data sources

Job Bank open data and 3-year outlooks (Government of Canada, Open Government Licence), Statistics Canada WDS, Alberta occupational outlook, Adzuna, Keenable search.

## AI usage

See `docs/ai-usage.md`.

## Running the web app

From the repo root:

```bash
npm run dev
```

Then open http://localhost:5180. Everything is on that one address:

- `/`: the landing page (`landing/`)
- `/app/`: the web app (`web/`): sign up, sign in, dashboard

Under the hood the web app's own dev server runs on 5173 and the landing server forwards `/app` and `/api` to it. Dependencies are installed on first run; Ctrl-C stops both. `/api` goes to the Worker set by `API_PROXY_TARGET` in `web/.env.local`, or a local `server/` on 8787 if unset.

Sign-up confirmation and magic-link emails return to `/app/`, so `http://localhost:5180/app/` must be in Supabase's redirect URLs (Authentication > URL Configuration).
