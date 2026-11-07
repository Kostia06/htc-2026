# Working on this repo

Hack the Change 2026. Read this before your first commit.

## Folders

| Folder | What lives there | Language |
|---|---|---|
| `server/` | Cloudflare Worker: API, research agent, memory, interview scoring | TypeScript |
| `web/` | React app (Vite): roadmap map, company pages, voice interview | JavaScript/TypeScript |
| `vr/` | WebXR interview scene for Meta Quest 3 | JavaScript/TypeScript |
| `ios/` | iPhone app | Swift |
| `scripts/` | One-off data ingest and seeding | TypeScript |
| `docs/` | Design, plan, AI usage log | Markdown |

Stay inside your folder. Changing something another folder depends on (an API route, a shared type)? Say so in the team chat first.

## Branches

- Never commit straight to `main`. Branch off it:
  - `feature/<area>-<thing>`, e.g. `feature/agent-memory`, `feature/web-vr`, `feature/ios-interview`
  - `fix/<area>-<thing>` for bugs
- Small PRs into `main`, one concern each. Rebase on `main` before merging (`git pull --rebase origin main`), no merge commits.
- Pull `main` often. Delete your branch after it's merged.
- Commit messages: short, imperative, under 50 characters ("Add memory search tool").

## Hackathon rules we can get disqualified for

- **Everything is built during the event.** No code from old projects.
- **Log every AI-assisted piece** in `docs/ai-usage.md` (tool, what it did, what you checked). It goes into the Devpost submission.
- **You must be able to explain any code you commit** in judging. If AI wrote it and you can't explain it, rewrite it or ask.
- **No secrets in git.** Keys go in `server/.dev.vars` (ignored) and `wrangler secret put` for production. Never put a key in `web/` or `ios/`.
- **Real data only** where we show numbers. Seeded example memory is marked `is_seeded` and labelled "example" in the UI.
- **The research agent only uses public pages**: obeys robots.txt, never touches Glassdoor, LinkedIn or Indeed, never gets around bot checks.
- Deadline: Devpost by **11:30 AM ABT Sunday Nov 8**. Aim for 10:30.

## Code style

- Few comments. Only write one when the *why* isn't obvious.
- No boilerplate docstrings, no "// Initialize the X".
- Tests next to the code they cover (`*.test.ts`). Server: `cd server && pnpm test`. Web: `cd web && npm run build`.
- Accessibility is part of done: keyboard, focus, captions, reduced motion.
