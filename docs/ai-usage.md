# AI usage

- **Claude Code** (Anthropic): coding assistant, used as a tool for planning, researching data sources, and writing and reviewing code. The team reviewed, tested and can explain everything it produced.
- **Gemini API** (Google): part of the product. It runs the research agent, interview scoring and the voice interviewer.

## Log

- **Supabase sign-in** (Claude Code): added email/password and magic-link sign-in to `web/` with `@supabase/supabase-js`, and taught the Worker's auth middleware (`server/src/auth/`) to accept Supabase access tokens, verified against the project's JWKS with `jose`. Anonymous session tokens still work. Checked: server typecheck, token checks (valid, wrong issuer, wrong audience, expired, wrong key) and a wrong-password sign-in against the live project.
