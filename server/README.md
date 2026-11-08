# server

Cloudflare Worker (TypeScript, Hono). Serves the API for the web app, the VR scene and the iOS app.

```
src/
  index.ts        routes wired together + the 6-hourly cron
  env.ts          bindings and secrets
  db/             one D1-shaped Database over D1 or Supabase Postgres (+ vectors over Vectorize or pgvector), picked by DB_BACKEND
  api/            HTTP routes, thin: validate input, call the logic, return JSON
  agents/         four agents that perform skills for one person (no open-ended chat)
    core/         loop (Gemini function calling), harness (runSkill), budgets, prompt, run records, types,
                  agent cards and the registry of agents
    shared-tools/ tools more than one agent holds (web_search, fetch_page, recall, profile, company facts...)
    resume/       profile-intake, onboarding-prefill; owns read_document
    research/     research-company; shared public facts only, never private memory
    interview/    interview-prep, interview-intel, interview-debrief, interview-recap; owns hn/devto search,
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
test/             same folders as src/, runs on D1 inside the Workers runtime
test-pg/          the Postgres adapter suite: the same store code on PGlite under plain Node (`pnpm test:pg`)
migrations/       D1 schema, applied with `pnpm db:migrate:remote`; the Supabase translation lives in ../supabase/migrations
scripts/          sqlite-to-postgres.mjs (translate a D1 migration), copy-d1-to-supabase.mjs (copy the live data)
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

GitHub (`connections/`, `integrations/composio.ts`, `api/connections.ts`) is read-only through Composio's REST API.
`POST /api/connections/github` returns a hosted sign-in link, `GET /api/connections` reports the state (and starts the
import once the sign-in finished), `POST /api/connections/github/import` re-imports, `DELETE /api/connections/github`
deletes the connection at Composio (revoking the token at GitHub) and everything the import added. Only the tools in
`connections/github/read-only.ts` can run; anything else is refused before a request is made. The OAuth token never
leaves Composio, Composio only sees a pseudonym for the person, repo fields are allowlisted, READMEs are stripped of
secrets, links and contact details before the `github-projects` skill writes grounded one-line summaries, and only those
derived summaries are kept (sealed in `user_connections`). Agents read them through the `github_profile` tool, which needs
private access. Secrets: `COMPOSIO_API_KEY` (missing: "not configured"), optionally `COMPOSIO_GITHUB_AUTH_CONFIG_ID`.

Routes in `api/agent.ts`: `POST /:skill` with `{ platform, input }`, `GET /runs/:id` for the run's owner, and
`GET /cards` listing every agent's card.

```bash
pnpm install
pnpm test        # runs inside the Workers runtime
pnpm typecheck
pnpm dev         # needs server/.dev.vars, see ../.env.example
pnpm test:pg     # the Postgres adapter suite, plain Node + PGlite
```

## Database: Supabase

The server's data lives in one of two places, chosen by the single var `DB_BACKEND` in `wrangler.jsonc`:

- `d1` (default today): Cloudflare D1 for tables, Vectorize for embeddings.
- `postgres`: Supabase Postgres through a Hyperdrive binding, with pgvector (`memory_vectors`) for embeddings.

All store code calls `db(env)` and `vectors(env)` (`src/db/`) instead of `env.DB` / `env.VECTORS`. `db(env)` returns a
D1-shaped `Database` (`prepare().bind().first()/all()/run()`, `batch()`, results with `results` and `meta.changes`),
so D1-style code runs on either backend. On Postgres each statement goes through `src/db/translate.ts`, which turns
the SQLite dialect into Postgres and throws `UnsupportedSql` for anything it cannot translate faithfully; the test
`test-pg/scan.test.ts` runs the translator over every `prepare()` string in the repo, so a SQLite-only query fails in
`pnpm test:pg`, not in production. `batch()` runs its statements in one transaction.

Translated: `?` and `?N` placeholders → `$n` (SQLite numbering rules); `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`;
`INSERT OR REPLACE` → `ON CONFLICT (pk) DO UPDATE` using the table's key from `PRIMARY_KEYS` in `translate.ts` (add
new tables there); `datetime('now' [, '-7 days'])` and `strftime(fmt, 'now')` → `to_char(...)` producing the same
text; `IFNULL` → `COALESCE`; `instr` → `strpos`; `LIKE` → `ILIKE` (SQLite's LIKE ignores case); DDL: `REAL` →
`DOUBLE PRECISION`, `BLOB` → `BYTEA`, `INTEGER PRIMARY KEY AUTOINCREMENT` → `BIGSERIAL PRIMARY KEY`, `WITHOUT ROWID`
dropped. Passed through because both dialects agree: `ON CONFLICT ... DO UPDATE ... WHERE`, `RETURNING`, `||`,
`substr`, `length`, `lower`, `COALESCE`, `COUNT`, `MAX`, `CASE`, subqueries, `IN (...)`, `LIMIT`/`OFFSET`, `0/1` flags.
Refused on purpose: `last_insert_rowid()` (use `RETURNING`), `julianday`, `group_concat`, `json_*`, `glob`, `total`,
`printf`, `changes()`, `PRAGMA`, `COLLATE NOCASE`, unquoted mixed-case aliases (`AS thisWeek` must be `AS "thisWeek"`,
Postgres folds names to lower case). Not detectable by the translator, so write it portably: `sum(<boolean>)` (use
`sum(CASE WHEN ... THEN 1 ELSE 0 END)`), and a bare `SELECT ? AS x` subquery column (use `CAST(? AS TEXT)`). Numbers:
`COUNT(*)` (int8) and `SUM` (numeric) are parsed to JS numbers, as D1 returns them.

Writing new D1 code: keep using `db(env)` and the D1 API; run `pnpm test:pg` once, it tells you if a query will not
translate. New migrations stay D1 files in `migrations/`; the Postgres copy is generated.

### Schema

`../supabase/migrations/2026110801_raven_schema.sql` is the translation of `migrations/0001`–`0018`, generated with
`node scripts/sqlite-to-postgres.mjs migrations/*.sql`, plus `create extension vector` and the `memory_vectors` table
(`id text pk, embedding vector(768), metadata jsonb, namespace text`, HNSW cosine index, GIN on metadata). Every
table has **row level security enabled with no policies** and `REVOKE ALL ... FROM anon, authenticated`: nothing is
readable through PostgREST with the anon/publishable key. The Worker connects as the **`postgres` role** (the one in
the dashboard's connection string), which owns the tables and is therefore not subject to RLS. If you create a
dedicated role for Hyperdrive instead, it must own the tables or have `BYPASSRLS`, or every query returns nothing.

The teammate's `public.profiles` (uuid id → auth.users, name, email, own-row policies) is untouched. Our encrypted
per-person tables (`user_profiles`, `user_memories`, `roadmap_*`, `voice_*`, `feed_*`, `user_documents`) are keyed by
`user_id TEXT`, which for a Supabase sign-in is `auth.users.id` = `profiles.id` as text; there is no foreign key
because headset and anonymous sessions have server-minted ids with no Supabase account.

Later D1 migrations (0019 on, from other branches): one Supabase migration file each,
`node scripts/sqlite-to-postgres.mjs migrations/0019_x.sql > ../supabase/migrations/<timestamp>_x.sql`. The script
fails with the offending statement if a migration uses something it cannot translate. Then `supabase db push` (or
paste into the SQL editor).

### Cut over

1. Apply the schema to the Supabase project (`supabase db push`, or the SQL editor). Local check first:
   `pnpm test:pg` applies the same file to PGlite and runs the store code against it.
2. Copy the data (idempotent, re-runnable; never prints the URL):
   `SUPABASE_DB_URL='postgres://postgres:...@db.<ref>.supabase.co:5432/postgres' pnpm db:copy-to-supabase`
   Use the direct or session-pooler connection string, not the transaction pooler. If the direct host is IPv6-only
   from your network, use the session pooler (`aws-0-<region>.pooler.supabase.com:5432`). `--dry-run` only reads.
3. Create the Hyperdrive config with the **direct connection** string (Cloudflare pools it):
   `pnpm exec wrangler hyperdrive create raven-supabase --connection-string="postgres://postgres:...@db.<ref>.supabase.co:5432/postgres"`
   Paste the printed id into the commented `hyperdrive` block in `wrangler.jsonc` and uncomment it.
4. Set `"DB_BACKEND": "postgres"` in `wrangler.jsonc` and `pnpm deploy`. Agent runs, feeds and cron now read and write
   Supabase. Nothing is cached across requests; each request gets one Postgres client via the first middleware.
5. Rebuild the vector index (Vectorize cannot export vectors, and the facts' text is in the tables):
   `pnpm exec wrangler secret put ADMIN_SECRET`, then
   `POST https://<worker>/admin/reembed-vectors?offset=0&limit=100` with `Authorization: Bearer <ADMIN_SECRET>`
   and repeat with the returned `next` until it is `null`. Each row costs one Workers AI embedding call. Without the
   secret the route is a 404. Until this runs, `memory_search` finds nothing on Postgres; facts saved after the
   cutover are embedded as usual.

Local dev on Postgres without Hyperdrive: put `DB_BACKEND=postgres` and `SUPABASE_DB_URL=...` in `.dev.vars`.

### Roll back

Set `"DB_BACKEND": "d1"` in `wrangler.jsonc` and `pnpm deploy`. D1 and Vectorize were never written to while on
Postgres, so they are exactly as they were at the cutover; anything written on Postgres in between stays there and
is not copied back.

Driver: [Postgres.js](https://github.com/porsager/postgres) 3.4.8 (`postgres`), one of the two drivers Cloudflare's
Hyperdrive docs list (https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/), with its own
`workerd` build, `sql.unsafe(text, params)` for the translated `$n` statements and `sql.begin` for `batch()`. It is
loaded lazily, so the D1 path never touches it. Cloudflare's docs call `pg` the recommended driver for caching; it
would be a one-file swap in `src/db/postgres.ts` (`postgresJsExecutor`). Per the same docs, do not set
`prepare: false` under Hyperdrive.
