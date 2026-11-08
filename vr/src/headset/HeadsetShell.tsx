import "./headset.css";
import type { HeadsetSession } from "../pairing/api";
import { PracticeMenu } from "../practice/PracticeMenu";
import { describeLaunch } from "./launches";
import type { HeadsetState } from "./session";
import { useLaunchPolling } from "./useLaunchPolling";

/** Wraps the practice menu once the headset is signed in: shows that it's listening for the phone, and the hand-off when a launch arrives. */
export function HeadsetShell({ session, onSignOut }: { session: HeadsetSession; onSignOut: () => void }) {
  const launch = useLaunchPolling(session, onSignOut);

  if (launch.phase === "launching") {
    return (
      <main className="screen centered launching" aria-live="assertive">
        <span className="launch-pulse" aria-hidden="true" />
        <h1>{describeLaunch(launch.launch)}</h1>
        <p className="lead">Sent from your phone</p>
      </main>
    );
  }

  return (
    <>
      <PracticeMenu token={session.token} onSignOut={onSignOut} />
      <footer className="headset-strip" aria-live="polite">
        <span className="headset-dot" aria-hidden="true" />
        <span>Waiting for your phone…</span>
        {session.deviceName && <span className="headset-name">{session.deviceName}</span>}
      </footer>
    </>
  );
}

/** Shown while a stored session is being refreshed, or while Raven can't be reached to refresh an expired one. */
export function RestoringScreen({ state }: { state: Extract<HeadsetState, { phase: "restoring" | "reconnecting" }> }) {
  return (
    <main className="screen centered">
      <p className="wordmark">Raven</p>
      <h1>{state.phase === "restoring" ? "Signing you in" : "Reconnecting"}</h1>
      <p className="lead">{state.phase === "restoring" ? "One moment" : "Raven isn't answering. Trying again shortly."}</p>
    </main>
  );
}
