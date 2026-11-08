// What the rest of the VR app needs from the headset module.
//
//   import { onLaunch } from "./headset";
//   useEffect(() => onLaunch((launch) => startPractice(launch)), []);
//
// `launch` is { mode, companySlug?, role?, stepId? }: pass mode/companySlug/role to POST /api/voice/sessions.
export { type Launch, type LaunchMode } from "./api";
export { HeadsetShell, RestoringScreen } from "./HeadsetShell";
export { describeLaunch, onLaunch } from "./launches";
export { useHeadsetSession } from "./useHeadsetSession";
