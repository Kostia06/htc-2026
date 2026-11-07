# server

Cloudflare Worker (TypeScript, Hono). Serves the API for the web app, the VR scene and the iOS app.

```
src/
  index.ts        routes wired together + the 6-hourly cron
  env.ts          bindings and secrets
  api/            HTTP routes, thin: validate input, call the logic, return JSON
  agents/
    core/         the agent loop (Gemini function calling, step and tool-call limits)
    research/     research agent and its tools (web_search, fetch_page, memory_search, save_fact)
  integrations/   one file per outside service: gemini, keenable, workers-ai (embeddings)
  memory/         storage logic: company facts, insights (k = 3 rule), vector search, cache, cleanup
    private/      per-person memory, AES-GCM encrypted per user, never embedded or shared
  auth/           anonymous session tokens (HMAC)
  lib/            small pure helpers: anonymize, robots.txt, hashing
test/             same folders as src/
migrations/       D1 schema, applied with `pnpm db:migrate:remote`
```

```bash
pnpm install
pnpm test        # runs inside the Workers runtime
pnpm typecheck
pnpm dev         # needs server/.dev.vars, see ../.env.example
```
