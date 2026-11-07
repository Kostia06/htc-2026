# AI usage

- **Claude Code** (Anthropic): coding assistant, used as a tool for planning, researching data sources, and writing and reviewing code. The team reviewed, tested and can explain everything it produced.
- **Gemini API** (Google): part of the product. It runs the research agent, interview scoring and the voice interviewer.

## Log

- **Supabase sign-in on the web** (Claude Code): added email/password and magic-link sign-in to `web/` with `@supabase/supabase-js`; requests to the Worker carry the Supabase access token, which the server's existing Supabase check verifies. Checked: web build and lint, and a wrong-password sign-in against the live project.
