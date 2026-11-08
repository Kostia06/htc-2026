# Wiring voice conversations into the VR scene

The voice backend is live at `https://htc-mentor.ilnkostia-dev.workers.dev` and already allows browser calls from
`https://raven-vr.ilnkostia-dev.workers.dev` and `http://localhost:5173`. The headset gets its bearer token from
the phone during sign-in (pairing). Every call below sends `Authorization: Bearer <token>`.

How the conversation should *sound* (stages, follow-ups, turn-taking): see `docs/conversation-design.md`.

## 1. Start a session

```
POST /api/voice/sessions
{ "mode": "interview", "companySlug": "atb", "role": "Junior data analyst" }
```

Returns (201):

```jsonc
{
  "sessionId": "…",
  "mode": "interview",
  "provider": "elevenlabs",
  "credentials": {
    "kind": "elevenlabs",
    "signedUrl": "wss://…",            // short-lived, one conversation (browser SDK)
    "conversationToken": "…",          // same session for the Swift SDK's WebRTC path (the phone); VR can ignore it
    "overrides": { "agent": { "prompt": { "prompt": "…" } } },
    "dynamicVariables": { "opening": "…" }
  },
  "opening": "Hi, thanks for coming in…",
  "questions": [{ "text": "…", "reported": true }]
}
```

Demo companies with researched facts: `atb`, `benevity`, `neo-financial`, `helcim`.

## 2. Talk (ElevenLabs in the browser)

```ts
import { Conversation } from "@elevenlabs/client";

const conversation = await Conversation.startSession({
  signedUrl: session.credentials.signedUrl,
  overrides: session.credentials.overrides,
  dynamicVariables: session.credentials.dynamicVariables,   // fills the agent's opening line
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
POST /api/voice/sessions/:id/finish
→ { overall: 0-100, verdict, strengths: [{ quote, why }], improvements: [{ moment, said, better, example }],
    perQuestion: [{ question, score, oneLineFeedback }], nextSteps: [string] }
GET  /api/voice/sessions/:id          → session + turns, for replay
```

## Staying signed in, and launches from the phone

Pairing (`POST /api/pairing/claim { code }`) now answers with more than a token:

```jsonc
{ "token": "…", "expiresAt": "…",            // access token, 1 hour
  "refreshToken": "…", "refreshExpiresAt": "…", // 60 days, rotates on every use
  "deviceId": "…", "deviceName": "Quest 3" }
```

The page keeps all of it in `localStorage` (`vr/src/headset/storage.ts`) and `useHeadsetSession` refreshes silently on load
and five minutes before `expiresAt` with `POST /api/headset/refresh { refreshToken }` (no bearer needed; same shape back).
A `401` there means the phone removed this headset (or the credential was already used): the keypad comes back. A network
failure keeps the credential and retries.

Once signed in, `useLaunchPolling` long-polls `GET /api/headset/launch?wait=20&device=<deviceId>` (the server answers early
with `{ "launch": { "mode", "companySlug?", "role?", "stepId?" } }` when the phone's Start button sent one, else `{ "launch": null }`;
polling more than once a second gets a 429). The `device` query marks the headset as *connected* for the phone
(`GET /api/headset/status` → `connected` when it polled in the last 30 s).

**For the scene:** register once and start the session from the launch; its fields go straight into `POST /api/voice/sessions`:

```ts
import { onLaunch } from "./headset";
useEffect(() => onLaunch((launch) => startPractice(launch)), []);
```

Until a listener is registered, `HeadsetShell` shows "Starting your interview with ATB…" for a moment and returns to the menu.
Phone side: `GET /api/headset/devices`, `DELETE /api/headset/devices/:id` (sign a headset out), `POST /api/headset/launch`.

## Coming next (being built now)

- `POST /api/voice/sessions/:id/next` — returns the interviewer's next short line (a follow-up or the next
  question). Used by the phone's on-device voice; VR can keep using ElevenLabs as above.
- Shorter, personal questions ("I saw you did research for Starfish — tell me about that").
