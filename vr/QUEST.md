# QUEST.md — running this scene on a Quest 3

Read the first two sections before touching anything, then use path 1.

## Do not enable HTTPS on the dev server

Vite 8 on Node 22 **crashes** the moment the HMR websocket tries to upgrade, if
the dev server is serving HTTPS:

```
TypeError: server.shouldUpgradeCallback is not a function
    at Server.<anonymous> (node:_http_server)
```

The page loads, then the process dies on the first websocket upgrade. This is
why `@vitejs/plugin-basic-ssl` is imported in `vite.config.js` but **deliberately
left out of `plugins`**. Leave it that way.

Concretely, do not:

- add `basicSsl()` to `plugins`
- set `server.https` to anything
- hand a cert/key to `npm run dev`

Someone already lost an hour to this. Seen on vite 8.3.6 / node 22.21.0. Every
path below gets a secure context *without* Node terminating TLS.

## Why the secure context is the whole problem

`navigator.xr` only exists on a secure context. `https://` origins qualify — and
so do `http://localhost` and `http://127.0.0.1`, because the spec treats loopback
as trustworthy. A plain `http://192.168.x.x` does **not**: `navigator.xr` is
undefined, `useVRSupport()` resolves false, and the Enter VR button is disabled.

That one fact is why the paths below are ranked the way they are.

## Path 1 — adb reverse over USB (use this)

`adb reverse` makes `localhost:5173` *inside the headset* forward down the USB
cable to the dev server on your Mac. The headset sees a loopback origin, so it is
a secure context: WebXR works, there is no certificate anywhere, and HMR keeps
working. This is the only path that gives you all three.

### One-time setup

1. Install platform-tools:

   ```bash
   brew install --cask android-platform-tools
   ```

2. Enable Developer Mode on the headset. This is done from the phone, not the
   headset: **Meta Horizon app → Menu → Devices → (your headset) → Headset
   Settings → Developer Mode → on**, then reboot the headset. It requires a Meta
   developer account with an "organization" — free, about two minutes, but do it
   now and not at 3am.

3. Connect the headset to the Mac with a **data** cable. The stock cable works;
   many random USB-C cables are charge-only and will show nothing in `adb`.

4. Put the headset on and accept the **Allow USB debugging** prompt. Tick
   *Always allow from this computer*.

### Every session

```bash
adb devices                      # expect:  <serial>   device
npm run dev                      # vite --host, port 5173
adb reverse tcp:5173 tcp:5173
```

Then in the headset, open **Meta Quest Browser** and go to:

```
http://localhost:5173
```

Press **Enter VR**.

### When it does not work

| Symptom | Fix |
|---|---|
| `adb devices` lists nothing | Headset asleep or a charge-only cable. Wake it, reseat the cable, then `adb kill-server && adb start-server`. |
| Device shows as `unauthorized` | The in-headset prompt was never accepted. Put the headset on, accept **Allow USB debugging**, tick always-allow, re-run `adb devices`. |
| Device shows as `offline` | Unplug, replug, `adb devices` again. |
| `adb reverse` says "device not found" | Reverse needs an authorised device — fix `adb devices` first. |
| Browser cannot connect | Dev server down, or the reverse was dropped. `adb reverse --list` to check. It does **not** survive unplugging or `adb kill-server` — just re-run it. |
| Vite printed `Port 5173 is in use, trying 5174` | Your reverse points at the wrong port. Kill the other server, or `adb reverse tcp:5174 tcp:5174` and open `localhost:5174`. |
| Page loads, Enter VR greyed out | Check the URL bar — a LAN IP instead of `localhost` does exactly this. Also close other tabs; one of them may hold the XR session. |

## Path 2 — LAN preview (layout checks only, no VR)

```bash
npm run build
npm run preview
```

The `--host` is already inside the `preview` script. `npm run preview --host`
does **not** forward that flag — npm swallows it. If you ever need to add flags,
it is `npm run preview -- --flag`.

Vite prints a Network URL like `http://192.168.1.42:4173`. Open it in the Quest
Browser.

**Works:** the page loads, the scene renders, panels and captions are there, and
you can eyeball layout, lighting and texture work in the flat browser window.

**Does not work:** immersive VR. `http://192.168.1.42` is not a secure context,
so `navigator.xr` is undefined and Enter VR stays disabled. No flag or browser
setting changes this. Do not plan any part of the demo around this path.

Note the failure mode is *not* the Vite HTTPS crash above — `preview` has no HMR
websocket, so nothing ever tries to upgrade. It is purely the missing secure
context. Which is also the trap: "preview doesn't crash, so let me just turn on
basicSsl" is how you end up with a self-signed cert, a cert warning to click
through in the headset, and a `npm run dev` that no longer starts. Use path 3
instead.

## Path 3 — tunnel (works, needs internet)

A tunnel terminates TLS at the edge and forwards plain HTTP to Vite. Node never
creates an HTTPS server, so the crash never happens, and the headset gets a real
publicly-trusted certificate — a proper secure context with no warnings.

```bash
brew install cloudflared
npm run dev
# second terminal:
cloudflared tunnel --url http://localhost:5173
```

cloudflared prints a `https://<random-words>.trycloudflare.com` URL. Open that in
the Quest Browser.

**You must allow the tunnel hostname or you get a 403.** Vite's dev server
rejects unknown `Host` headers and `server.allowedHosts` is empty, so the tunnel
URL otherwise returns:

```
Blocked request. This host ("xxx.trycloudflare.com") is not allowed.
To allow this host, add "xxx.trycloudflare.com" to `server.allowedHosts` in vite.config.js.
```

Do not edit the shared config for this. Pass it through the environment:

```bash
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=".trycloudflare.com" npm run dev
```

The leading dot matches any subdomain, so you do not have to re-run it when
cloudflared hands you a new URL. Verified on vite 8.3.6; the same variable also
works for `npm run preview`. LAN IPs are allowed by default, which is why path 2
never hits this.

ngrok equivalent: `ngrok http 5173`, and allow `.ngrok-free.app` the same way.

Costs: needs working venue wifi, adds latency to every request, and HMR now
round-trips through the tunnel. Fine as a backup, worse than path 1.

## Remote debugging (chrome://inspect)

With the headset connected over USB and Developer Mode on:

1. Open `chrome://inspect/#devices` in desktop Chrome.
2. Find the Quest under **Remote Target**, click **inspect** next to the
   `localhost:5173` page.

You now have a real devtools console attached to the page running inside the
headset. The app exposes two handles in dev builds for exactly this:

```js
window.__interview   // phase machine: phase, question, result, actions
window.__rig         // avatar bones; __rig.pose is live-tweakable
```

So you can drive the interview or retune the seated pose without taking the
headset off:

```js
__interview.phase
__interview.actions.begin()
__rig.pose.LeftUpLeg.x = -1.3
```

Both are `import.meta.env.DEV` only — they do not exist in a built bundle. That
means debugging happens on `npm run dev` over path 1, not on a preview build.

## Casting for judges

In-headset: **Camera → Cast → Computer**, then open
<https://www.oculus.com/casting> on the laptop signed into the same Meta account.

**Casting is flaky.** It drops on congested wifi, needs re-pairing after the
headset sleeps, and sometimes just renders a black frame. In a room with a few
hundred radios, assume it fails at least once.

Therefore, non-negotiable:

- **Record a backup video of a full VR run before demo day.** Screen-record the
  cast while it is working. If casting dies on stage you play the video and keep
  talking. This is the difference between a 60-second segment and a dead demo.
- Keep the desktop build open in a second browser tab. Same scene, OrbitControls
  camera, keyboard driven: `Enter` begin/next, hold `Space` to answer, `M` mute.

## Demo day checklist

- [ ] Headset charged, controllers have fresh batteries. Path 1 keeps the headset
      charging over USB anyway — use it.
- [ ] Guardian re-run at the demo spot, in that room's lighting, as a **seated**
      boundary. A Guardian from another room throws up walls mid-answer.
- [ ] `public/avatars/interviewer.glb` present — `npm run avatar -- <url-or-file>`
      — and its morph-target line reads Oculus visemes or ARKit, or the
      interviewer will talk with a closed mouth on stage. Ready Player Me shut
      down on 2026-01-31; README.md lists what to use instead, Avaturn first. A
      missing file is survivable (the scene falls back to the built-in procedural
      figure, which does lip sync), but do not demo the fallback.
- [ ] Backup video of a full VR run recorded and playable **offline**.
- [ ] Desktop fallback tab open, already loaded, past the first question.
- [ ] `adb devices` shows `device`, `adb reverse --list` shows 5173, and you have
      loaded `localhost:5173` in the headset at least once today.
- [ ] Mic permission already granted for `http://localhost:5173` in the Quest
      Browser. The prompt appears on the first answer; granting it mid-demo burns
      15 awkward seconds.
- [ ] Every other Quest Browser tab closed — they steal the XR session and GPU.
- [ ] Headset volume up. The interviewer speaks through `speechSynthesis`; a
      muted headset reads as a broken demo.
