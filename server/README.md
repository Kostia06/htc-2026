# server

Cloudflare Worker (TypeScript, Hono). Serves the API for the web app, the VR scene and the iOS app.

```
src/
  index.ts        routes wired together + the 6-hourly cron
  env.ts          bindings and secrets
  api/            HTTP routes, thin: validate input, call the logic, return JSON
  agents/         one agent that performs skills for one person (no open-ended chat)
    core/         loop (Gemini function calling), harness (runSkill), budgets, prompt, run records, types
    tools/        one tool per file; tools get a per-run context, never globals
    skills/       one skill per file: allowed platforms, tool allowlist, instructions, input and output schema
    background.ts research runs outside a request: cooldown claim, cron over tracked companies
    live.ts       real dependencies (Gemini, Keenable, D1, Vectorize) wired for a request or the cron
  integrations/   one file per outside service: gemini, keenable, workers-ai (embeddings), adzuna, hacker-news, devto, robots-txt
  memory/         storage logic: company facts, insights (k = 3 rule), vector search, cache, cleanup
    private/      per-person memory, AES-GCM encrypted per user, never embedded or shared
  auth/           anonymous session tokens (HMAC)
  lib/            small pure helpers: anonymize, robots.txt, source policy, hashing
test/             same folders as src/
migrations/       D1 schema, applied with `pnpm db:migrate:remote`
```

A skill runs the same from the web app, the VR headset or the background; the platform only changes the output style
(VR is short and speakable). The harness shows the model only the skill's tools plus `finish`, adds up to 8 items from
the person's private memory to the prompt, caps each run (6 page fetches, 25 tool calls), scrubs contact details from
the output and records every run in `agent_runs`.

Skills: `research-company` (background), `interview-prep` (app, vr), `interview-debrief` (app, vr), `career-snapshot` (app).
Keenable's `/fetch` ignores the target site's robots.txt, so `fetch_page` decides for itself. `lib/source-policy.ts` never
fetches Reddit, jointaro, Job Bank, Adzuna pages, Glassdoor, LinkedIn or Indeed. Everything else needs a readable
robots.txt (cached 6 h) that allows the page for us and for `*`, and the site's Crawl-delay must have passed. Reddit only
shows up as short search snippets labelled `anecdote` and is never saved as a fact. Job listings come only from the Adzuna
API (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`), each one labelled "Jobs by Adzuna".

Routes in `api/agent.ts`: `POST /:skill` with `{ platform, input }`, and `GET /runs/:id` for the run's owner.

```bash
pnpm install
pnpm test        # runs inside the Workers runtime
pnpm typecheck
pnpm dev         # needs server/.dev.vars, see ../.env.example
```
