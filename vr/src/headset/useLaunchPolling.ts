import { useEffect, useState } from "react";
import type { HeadsetSession } from "../pairing/api";
import { type Launch, SignedOutError, pollLaunch } from "./api";
import { emitLaunch } from "./launches";

// after a failed poll; a long poll that simply timed out starts the next one at once
const RETRY_MS = 3000;
// how long "Starting…" stays up when no scene has registered to take the launch
const UNHANDLED_LAUNCH_MS = 4000;

export type LaunchState = { phase: "waiting" } | { phase: "launching"; launch: Launch };

/** Long-polls for launches from the phone while the headset is signed in, and hands each one to `onLaunch` listeners. */
export function useLaunchPolling(session: HeadsetSession, onSignedOut: () => void) {
  const [state, setState] = useState<LaunchState>({ phase: "waiting" });
  const isWaiting = state.phase === "waiting";

  useEffect(() => {
    if (!isWaiting) return;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const launch = await pollLaunch(session, controller.signal);
        if (controller.signal.aborted) return;
        if (launch) {
          setState({ phase: "launching", launch });
          // a scene that registered starts the session; without one the menu comes back after a moment
          if (emitLaunch(launch) === 0) retry = setTimeout(() => setState({ phase: "waiting" }), UNHANDLED_LAUNCH_MS);
          return;
        }
        void poll();
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof SignedOutError) return onSignedOut();
        retry = setTimeout(() => void poll(), RETRY_MS);
      }
    };
    void poll();

    return () => {
      controller.abort();
      clearTimeout(retry);
    };
  }, [session, isWaiting, onSignedOut]);

  return state;
}
