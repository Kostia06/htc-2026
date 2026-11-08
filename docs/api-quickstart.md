# Skillit API — quick start for teammates

Live server: `https://htc-mentor.ilnkostia-dev.workers.dev` (deployed from `main`).
Browsers may call it from `http://localhost:5173` and `https://raven-vr.ilnkostia-dev.workers.dev`; ask in chat to add another origin.

## Get a token

- **Real account:** sign in with Supabase (iOS app / web) and send the Supabase access token.
- **Quick testing:** `POST /api/session` returns `{ token }` for a throwaway anonymous user.
- **Headset:** phone `POST /api/pairing/offer` → 4-digit code; headset `POST /api/pairing/claim { code }` → `{ token }`.

Send it on every call: `Authorization: Bearer <token>`.

## Try it (Node / browser console)

```js
const B = "https://htc-mentor.ilnkostia-dev.workers.dev";
const { token } = await (await fetch(B + "/api/session", { method: "POST" })).json();
const H = { authorization: `Bearer ${token}`, "content-type": "application/json" };

await fetch(B + "/api/me/profile", { method: "PATCH", headers: H,
  body: JSON.stringify({ targetRoles: ["Junior data analyst"], skills: [{ name: "SQL", source: "self" }] }) });

await (await fetch(B + "/api/roadmap", { headers: H })).json();      // personalised steps
await (await fetch(B + "/api/feed", { headers: H })).json();         // jobs (first call may say building:true)
await (await fetch(B + "/api/memory/atb", { headers: H })).json();   // researched company facts
```

## What's there

| Area | Endpoints |
|---|---|
| Profile | `GET/PATCH/DELETE /api/me/profile` |
| Onboarding | `POST /api/onboarding/resume` (multipart `file`) → draft · `POST /api/onboarding/confirm` |
| Roadmap | `GET /api/roadmap?cursor=` · `POST /api/roadmap/steps/:id { status }` |
| For you | `GET /api/feed?cursor=` |
| Company research | `GET /api/memory/:slug` · `POST /api/research/:slug` (30-min cooldown) — demo: `atb`, `benevity`, `neo-financial`, `helcim` |
| Voice practice | `POST /api/voice/sessions { mode, companySlug?, role? }` · `/turns` · `/next` · `/finish` — see `docs/vr-voice-integration.md` |
| Agents | `GET /api/agent/cards` · `POST /api/agent/:skill { platform, input }` |
| A2A | `GET /.well-known/agent-card.json` · `POST /a2a` (JSON-RPC, header `A2A-Version: 1.0`) |

Voice sessions use ElevenLabs (interviewer: Eric) — every connected minute spends credit, keep tests short.
The roadmap, For you, resume and settings screens are being rebuilt now; their API shapes may change in the next deploy.
