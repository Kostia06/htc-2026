// Meta's Immersive Web Emulator Runtime: a fake Quest 3 (headset, controllers,
// hands) in a desktop browser, with a control panel to move them. Lets the
// whole XR flow — Enter VR, rays, trigger, haptics calls — run without a
// headset. Dev only: `npm run dev`, then open /?emulate. A production build
// includes it only when built with VITE_EMULATE=1 (and then still needs ?emulate).

const ALLOWED = import.meta.env.DEV || import.meta.env.VITE_EMULATE === '1'

export async function installEmulatorIfAsked() {
  if (!ALLOWED) return false
  if (!new URLSearchParams(window.location.search).has('emulate')) return false
  try {
    const [{ XRDevice, metaQuest3 }, { DevUI }] = await Promise.all([import('iwer'), import('@iwer/devui')])
    const device = new XRDevice(metaQuest3)
    // Seated at the candidate's chair, eyes where the scene expects them.
    device.position.set(0, 1.35, 0)
    // Desktop Chrome ships a navigator.xr that supports no headset; replace it.
    device.installRuntime({ forceInstall: true })
    new DevUI(device)
    window.__xrDevice = device
    return true
  } catch (error) {
    console.warn('Could not start the XR emulator; carrying on without it.', error)
    return false
  }
}
