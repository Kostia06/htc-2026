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
interviewer, drag to orbit. In VR: trigger to begin/advance, hold it to answer.

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

**The whole scene currently runs on stub example data.** `createStubSession()`
returns canned questions and scores, so the demo works whether or not the API is
up. Wiring in the real backend means replacing the bodies of `start()`,
`nextQuestion()`, `submitAnswer()`, `finish()` and the `isStub` flag in that one
file, and changing nothing under `src/scene/`. The exact return shapes are in the
header comment of `session.js` — keep the signatures. All are async, and the
scene already handles latency and rejections, so real network calls need no
changes elsewhere.

Everything the stub returns is flagged `isSeeded: true` and the UI shows an
**Example data** badge. That badge is a requirement, not decoration: example rows
must never read as real interview reports.
