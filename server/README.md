# server

Cloudflare Worker (TypeScript, Hono). Serves the API for the web app, the VR scene and the iOS app.

```
src/
  index.ts        routes wired together + the 6-hourly cron
  env.ts          bindings and secrets
  api/            HTTP routes, thin: validate input, call the logic, return JSON
  agents/         four agents that perform skills for one person (no open-ended chat)
    core/         loop (Gemini function calling), harness (runSkill), budgets, prompt, run records, types,
                  agent cards and the registry of agents
    shared-tools/ tools more than one agent holds (web_search, fetch_page, recall, profile, company facts...)
    resume/       profile-intake, onboarding-prefill; owns read_document
    research/     research-company; shared public facts only, never private memory
    interview/    interview-prep, interview-intel, interview-debrief, networking-recap; owns hn/devto search,
                  queue_research, remember
    career/       career-snapshot, recommend-jobs/-courses/-research; owns job_postings
    orchestrator/ the only way into an agent: routes a skill id to its agent and performs handoffs
    background.ts research runs outside a request: cooldown claim, cron over tracked companies
    live.ts       real dependencies (Gemini, Keenable, D1, Vectorize) wired for a request or the cron
  integrations/   one file per outside service: gemini, keenable, workers-ai (embeddings), adzuna, hacker-news, devto, robots-txt
  memory/         storage logic: company facts, insights (k = 3 rule), vector search, cache, cleanup
    private/      per-person memory, AES-GCM encrypted per user, never embedded or shared
  auth/           Supabase sign-in, plus HMAC tokens for paired headsets
  lib/            small pure helpers: anonymize, robots.txt, source policy, hashing
test/             same folders as src/
migrations/       D1 schema, applied with `pnpm db:migrate:remote`
```

A skill runs the same from the web app, the VR headset or the background; the platform only changes the output style
(VR is short and speakable). The harness shows the model only the skill's tools plus `finish`, adds up to 8 items from
the person's private memory to the prompt, caps each run (6 page fetches, 25 tool calls), scrubs contact details from
the output and records every run in `agent_runs`.

Each agent folder has `agent.ts` (its skills and the toolbox they may use: its own `tools/` plus the shared tools it
lists), `card.ts` (name, description and skills, derived from the skill objects) and `skills/`. A skill is bound only to
tools in its agent's toolbox, checked at startup. Agents never call each other: the orchestrator hands work between
them. Today's one handoff: before `interview-prep` or `interview-intel`, if the company has no facts newer than 7 days,
it queues `research-company` in the background (same 30-minute research cooldown, runs as nobody, no private memory).
Keenable's `/fetch` ignores the target site's robots.txt, so `fetch_page` decides for itself. `lib/source-policy.ts` never
fetches Reddit, jointaro, Job Bank, Adzuna pages, Glassdoor, LinkedIn or Indeed. Everything else needs a readable
robots.txt (cached 6 h) that allows the page for us and for `*`, and the site's Crawl-delay must have passed. Reddit only
shows up as short search snippets labelled `anecdote` and is never saved as a fact. Job listings come only from the Adzuna
API (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`), each one labelled "Jobs by Adzuna".

Routes in `api/agent.ts`: `POST /:skill` with `{ platform, input }`, `GET /runs/:id` for the run's owner, and
`GET /cards` listing every agent's card.

```bash
pnpm install
pnpm test        # runs inside the Workers runtime
pnpm typecheck
pnpm dev         # needs server/.dev.vars, see ../.env.example
```
