# AI usage

- **Claude Code** (Anthropic): coding assistant, used as a tool for planning, researching data sources, and writing and reviewing code. The team reviewed, tested and can explain everything it produced.
- **Gemini API** (Google): part of the product. It runs the research agent, interview scoring and the voice interviewer.

## Log

- **Supabase sign-in on the web** (Claude Code): added email/password and magic-link sign-in to `web/` with `@supabase/supabase-js`; requests to the Worker carry the Supabase access token, which the server's existing Supabase check verifies. Checked: web build and lint, and a wrong-password sign-in against the live project.
- **Web onboarding questions** (Claude Code): wrote the post-sign-in questions (stage, school, target roles, search so far, skills, location, weekly time) in `web/src/onboarding/`; answers are kept on the device and sent to the existing `PATCH /api/me/profile`. Checked: web build and lint, and a click-through of every step in the browser.
- **Resume upload in onboarding** (Claude Code): first onboarding step uploads a resume to the existing `POST /api/onboarding/resume`, maps the AI draft onto pre-selected answers the person can change, and saves through `POST /api/onboarding/confirm`. Checked: web build and lint, the error path against the live server, and the pre-fill path with a mocked draft.
