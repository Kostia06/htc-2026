# Wiring voice conversations into the VR scene

The voice backend is live at `https://htc-mentor.ilnkostia-dev.workers.dev` and already allows browser calls from
`https://raven-vr.ilnkostia-dev.workers.dev` and `http://localhost:5173`. The headset gets its bearer token from
the phone during sign-in (pairing). Every call below sends `Authorization: Bearer <token>`.

How the conversation should *sound* (stages, follow-ups, networking flow): see `docs/conversation-design.md`.

## 1. Start a session

```
POST /api/voice/sessions
{ "mode": "interview" | "networking", "companySlug": "atb", "role": "Junior data analyst" }
```

Returns (201):

```jsonc
{
  "sessionId": "…",
  "mode": "interview",
  "provider": "elevenlabs",
  "credentials": {
    "kind": "elevenlabs",
    "signedUrl": "wss://…",            // short-lived, one conversation
    "overrides": { "agent": { "prompt": { "prompt": "…" }, "firstMessage": "…" } }
  },
  "opening": "Hi, thanks for coming in…",
  "questions": [{ "text": "…", "reported": true }],   // interview
  "persona": { … }, "goals": [ … ]                     // networking
}
```

Demo companies with researched facts: `atb`, `benevity`, `neo-financial`, `helcim`.

## 2. Talk (ElevenLabs in the browser)

```ts
import { Conversation } from "@elevenlabs/client";

const conversation = await Conversation.startSession({
  signedUrl: session.credentials.signedUrl,
  overrides: session.credentials.overrides,
  onMessage: ({ source, message }) => showCaption(source, message),   // source: "user" | "ai"
  onModeChange: ({ mode }) => setAvatarTalking(mode === "speaking"),  // drive the avatar's mouth/animation
});
// End button:
await conversation.endSession();
```

ElevenLabs handles listening, turn-taking and interruptions. Every minute of a connected conversation spends
ElevenLabs credit — keep test sessions short and always call `endSession()`.

## 3. Score each answer (shows the tip in VR)

After each user answer (from the captions):

```
POST /api/voice/sessions/:id/turns
{ "question": "…", "answer": "…", "durationMs": 42000 }
→ { "scores": { … }, "delivery": { "wordsPerMinute": 140, "fillerWords": 3 }, "tip": "…" }
```

Fast (no LLM wait). Show `tip` as a small panel; don't read it aloud mid-interview.

## 4. Finish and debrief

```
POST /api/voice/sessions/:id/finish   → { summary, prepList: [{ step, why }] }
GET  /api/voice/sessions/:id          → session + turns, for replay
```

## Coming next (being built now)

- `POST /api/voice/sessions/:id/next` — returns the interviewer's next short line (a follow-up or the next
  question). Used by the phone's on-device voice; VR can keep using ElevenLabs as above.
- Shorter, personal questions ("I saw you did research for Starfish — tell me about that").

## Two voices for networking

The interviewer and the networking contact should sound like different people. ElevenLabs lets a session
override the voice only if "voice" overrides are enabled in the agent's Security settings; until then, the
simplest option is a second ElevenLabs agent for the networking persona (its id goes in the server's
`ELEVENLABS_NETWORKING_AGENT_ID` — not wired yet, ask in the team chat).
