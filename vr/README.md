# vr — WebXR interview scene

The VR interview room: a seated interviewer across a desk asks a question, listens
to the answer, shows a score. Built for Meta Quest 3 in the Quest Browser; also
runs in a desktop browser, which is the demo fallback. Its own Vite app with its
own `package.json`, separate from `web/`. React 19 · @react-three/fiber 9 ·
drei 10 · @react-three/xr 6 · three 0.187.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Desktop: `Enter` begins and advances, hold `Space` while answering, `M` mutes the
interviewer, `Esc` ends the interview, drag to orbit. In VR: point and pull the
trigger to press a panel or key; during the interview the trigger (or A) starts
an answer and releasing it finishes; B ends the interview. The menu has
Seated / Standing, Recenter, Captions and "How it works". Clicking the thumbstick
re-levels your eye height; pushing it up or down nudges it.

A first-run "How it works" card explains the controls once per device
(desktop and headset separately); dismissed, it stays gone.

## Run the full XR flow without a headset

Meta's Immersive Web Emulator Runtime ([`iwer`](https://www.npmjs.com/package/iwer)
and [`@iwer/devui`](https://www.npmjs.com/package/@iwer/devui), both MIT, pinned at
2.8.0 as devDependencies) can stand in for a Quest 3:

```bash
npm run dev
open "http://localhost:5173/?emulate"   # then press Enter VR
```

The emulator replaces `navigator.xr` before the app loads, so Enter VR, the
controller rays, the trigger, B and haptic calls all run in a desktop browser.
The DevUI panel moves the headset and controllers; from devtools,
`window.__xrDevice.controllers.right` can be posed and its trigger set with
`updateButtonValue('trigger', 1)`. It is dev only: a production build drops
`src/emulator.js`'s imports unless built with `VITE_EMULATE=1` (and then still
needs `?emulate`).

## The look

`src/theme/` is the one source of truth for the in-room UI: the app's palette
(green-charcoal surfaces, sage = press this, sand = the interviewer/AI, teal
good, coral needs work), type ramp in points (1 pt = 1.8 mm), card radius,
slab depth, key travel and the Skillit mark. Panels are matte slabs ~2 cm thick
with softened edges and a soft shadow; keys stand 7 mm proud, lighten and come
forward under the ray, travel in on press and tick the controller's haptics.
`Panel` (from `Panels.jsx`) is the app's card, and `src/theme/Report.jsx` has the
phone report's pieces (score headline, list rows, meters) for any new panel.

During the interview the room stays as close to a real one as possible: no
status text or spinners and nothing over or under the interviewer, just the desk
key (Answer / Done), a small Recording pill beside it while the call is recorded,
and the score card on the left for six seconds after an answer. Captions are
opt-in: the Captions switch in the headset menu (or the desktop bar) puts them
under him; screen readers get every line either way. After the interview the
review sits on the right, the same size and height as the score card, upright.
Controller models and rays only exist inside an XR session. His voice is spatialised from his mouth
(`src/interview/spatialAudio.js`), and he nods as you finish an answer.

Assets and licences: [ASSETS.md](./ASSETS.md).

## Signing in and the API

The room opens on a 4-digit keypad. On the phone, Skillit → Practice → Practice
in VR shows a code; typing it claims the pairing (`POST /api/pairing/claim`). The
session is kept in `localStorage` under `raven.headset` (the old 2D page's key, so
signed-in headsets stay signed in) and refreshed before it expires
(`POST /api/headset/refresh`). While signed in and idle, the headset long-polls
`GET /api/headset/launch`, so starting a VR session on the phone starts the
interview here. "Try with example data instead" skips sign-in and runs on the
stub, badged as sample scores.

The API is `VITE_RAVEN_API_URL`, default `https://api.skillit.study`. For a local
Worker, put `VITE_RAVEN_API_URL=http://localhost:8799` in `.env.local` and add the
page's origin to `ALLOWED_ORIGINS` in `server/.dev.vars`.

## Deploy

`npm run deploy` builds and runs `wrangler deploy` with `wrangler.jsonc` (Worker
`raven-vr`, static assets on https://vr.skillit.study). `.env.production` is
gitignored; without it the build already points at `https://api.skillit.study`.

## The avatar

Any rigged humanoid GLB at `public/avatars/interviewer.glb`:

```bash
npm run avatar -- <https-url-or-local-path>
```

It validates the file before writing it, then prints what is inside: skinned
mesh, bone count, and which facial morph targets it has. Lip sync drives Oculus
visemes (`viseme_aa` …) directly and otherwise maps them onto the ARKit set
(`jawOpen`, `mouthFunnel`, `mouthSmileLeft` …); with neither, the avatar renders
perfectly and simply never moves its mouth. The loader is vendor-neutral:
`buildRig()` resolves bone names across Mixamo (`mixamorig:`), Rocketbox
(`Bip01_`) and generic (`thigh_l`) rigs, so all it needs is a rigged humanoid,
ideally with facial morph targets.

**Ready Player Me shut down permanently on 2026-01-31** (acquired by Netflix):
creator, API and `models.readyplayer.me` all offline, nothing to retry. Instead:

- **[Avaturn](https://avaturn.me)** — closest replacement. Realistic, exports GLB
  with ARKit blendshapes. Try this first.
- **[Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox)** — 100+
  realistic business-attire avatars, MIT, archived. FBX, convert it, no visemes.
- **[Mixamo](https://mixamo.com)** — rigged characters, FBX, no blendshapes.
- **VRoid / VRM** — has visemes, but anime styling is wrong for a job interview.

**The scene works with no avatar at all.** `AvatarBoundary` falls back to a
built-in procedural figure that breathes, blinks, tracks the user's head and lip
syncs — nobody should be blocked on this. A third-party avatar asset is fine
under the hackathon rules like any library; credit it on the Devpost submission
next to the required AI-use disclosure.

## On the Quest 3

See **[QUEST.md](./QUEST.md)**. Short version: `adb reverse tcp:5173 tcp:5173`
over USB, then open `http://localhost:5173` in the Quest Browser — loopback is a
secure context, so WebXR works with no certificate. Do not enable HTTPS on the
dev server; Vite 8 on Node 22 crashes on the HMR websocket upgrade. QUEST.md
covers that and the two fallback paths.

## Layout

```
src/
  interview/          state and the backend seam
    session.js        THE SEAM — see below
    questions.js      example questions and scores
    speech.js         text-to-speech / speech-to-text wrappers
    useInterview.js   phases: idle → asking → awaiting → listening → scoring → review → done
  scene/              presentation only, knows nothing about the backend
    Scene.jsx         assembly and input; tuning constants at the top
    Room.jsx          desk, chair, walls, window, props
    Interviewer.jsx   GLB loading, per-frame face/body driving, fallback figure
    avatarRig.js      seated pose, procedural idle, gaze
    lipSync.js        viseme and blink driver (pure functions)
    Panels.jsx        question panel, review panel, action button
  ui/Overlay.jsx      2D chrome: captions, Enter VR, mute (hidden inside XR)
```

## `src/interview/session.js` is the only integration point

Signed in, `createApiSession()` runs the interview on the Skillit voice API with
the headset's token: `POST /api/voice/sessions`, then `/turns` (scores) and
`/next` (the interviewer's next line) per answer, then `/finish` for the
debrief. When the server offers a realtime voice agent, `useInterview` hands the
conversation to it and only scores turns. Scores are shown out of 100. Not
signed in, `createStubSession()` returns canned questions and scores.

Everything the stub returns is flagged `isSeeded: true` and the UI shows an
**Example data** badge. That badge is a requirement, not decoration: example rows
must never read as real interview reports.
