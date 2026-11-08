# AI usage

We used AI heavily, and we're disclosing all of it.

## Tools we used to build

| Who | Tool | Used for |
|---|---|---|
| Kostia | Claude Code (Anthropic) — _plan: fill in_ | Planning, research into data sources, and writing and reviewing most of the server, agent, iOS and web code |
| Tanzim | Claude Code (Anthropic) — _plan: fill in_ | The VR room, interviewer avatar, lip sync and scene tests |
| Araf | _fill in_ | Web app, resume builder |
| Kartik | _fill in_ | _fill in_ |

## How we worked with it

- **Specs before code.** Each feature started from a written brief: what it does, which files it owns, the API shape, and the privacy rules it must follow. Nothing was built from a one-line request.
- **Tests first.** Logic changes started with a failing test. The project has about 1,500 automated tests across the server, iOS, VR and web.
- **Gated merges.** Nothing reached `main` unless the type check, tests, lint and release builds all passed. Several AI-written changes were rejected or fixed at this step (broken release builds, duplicated logic, a merge that undid a security filter).
- **Human testing on real devices.** We tested every flow ourselves on iPhone, Quest 3 and the web, reported what was wrong, and had it fixed and re-tested. Most of the night's commits came from that loop.
- **People made the decisions.** Product direction, scope, design, which data sources were allowed, the privacy rules (encryption per user, the 3-person rule for shared memory, read-only connected apps) and every deploy were decided by the team.
- **Logged here.** The table below records what the AI produced and what we checked or changed.

## AI inside the product

- **Gemini** (Google): research agent, resume reading and tailoring, interview scoring, reports.
- **ElevenLabs:** the interviewer's live voice.
- **Jev:** fast scoring and checks (prompt-injection screening, requirement matching).
- **Keenable:** web search and page reading for company research.
- **Cloudflare Workers AI:** embeddings for memory search.

## Log

- **Supabase sign-in on the web** (Claude Code): added email/password and magic-link sign-in to `web/` with `@supabase/supabase-js`; requests to the Worker carry the Supabase access token, which the server's existing Supabase check verifies. Checked: web build and lint, and a wrong-password sign-in against the live project.
- **Web onboarding questions** (Claude Code): wrote the post-sign-in questions (stage, school, target roles, search so far, skills, location, weekly time) in `web/src/onboarding/`; answers are kept on the device and sent to the existing `PATCH /api/me/profile`. Checked: web build and lint, and a click-through of every step in the browser.
- **Resume upload in onboarding** (Claude Code): first onboarding step uploads a resume to the existing `POST /api/onboarding/resume`, maps the AI draft onto pre-selected answers the person can change, and saves through `POST /api/onboarding/confirm`. Checked: web build and lint, the error path against the live server, and the pre-fill path with a mocked draft.
- **AI dashboard on the web** (Claude Code): after onboarding, the resume step shows the AI's summary, the evidence quote for each skill, skills it left out and what's still worth adding (matching iOS), and a new signed-in home in `web/src/dashboard/` runs the existing agent skills through `POST /api/agent/:skill`: career snapshot (automatic), job, UCalgary course and research recommendations, interview prep for a company, a typed mock interview on the existing `/api/voice` sessions with per-answer scores and a debrief, and a view of what the agents remember with delete. Checked: web build and lint, a server render of every panel with sample skill outputs, and the deployed Worker serving the agent routes.

| When | Tool | What it did | What we changed or checked |
|---|---|---|---|
| Nov 7 | Claude Code | Read the runbook and opening slides, summarized rules and judging criteria | Checked against the runbook PDF |
| Nov 7 | Claude Code | Probed public APIs (AESO, Job Bank, StatCan, Open Alberta) to see what data is usable | Kept only sources that responded with real data |
| Nov 7 | Claude Code | Drafted design doc and implementation plan from the team's idea doc | Team set scope: VR as headline, full app + iOS |
| Nov 7 | Claude Code | Scaffolded `vr/` as a standalone R3F + @react-three/xr app: interview room, seated interviewer rig, viseme lip sync, score panels, controller/keyboard input | Tanzim reviewed and tuned the scene layout and pose constants in-headset; verified the full interview flow end to end in a browser |
| Nov 7 | Claude Code | Wrote the stubbed `session.js` seam against the documented Worker contract, so the VR scene runs on example data until the API lands | Tanzim checked the stub's `AnswerScore` shape matches the server contract field for field |
| Nov 7 | Claude Code | Generated unit tests for the lip-sync driver and the session stub (12 tests), mutation-checked | Tanzim reviewed the assertions; the tests caught a real bug where the question text was never sent to `/answer` |
| Nov 7 | Claude Code | Built the procedural seated interviewer (head, face, posed arms) and polished the room: window with mullions, credenza, acoustic panels, door, clock, ceiling fixtures | Tanzim reviewed every render; fixed the dark panels behind the interviewer and an overlay contrast failure the brighter room introduced |
| Nov 7 | Claude Code | Rebuilt the VR room as a corporate boardroom with runtime-generated textures (wood, carpet, wall, building facades) — no downloaded assets | Tanzim reviewed each render; fixed grommets catching light, a table 12cm from the user's chest, and an unlit back wall |
| Nov 7 | Claude Code | Sourced and converted the Microsoft Rocketbox `Business_Male_01` avatar (MIT) from FBX to GLB via Blender, pruning 175 morph targets to the 27 used | Tanzim verified the visemes actually drive the mouth, and credited Rocketbox in `vr/public/avatars/ATTRIBUTION.md` |

