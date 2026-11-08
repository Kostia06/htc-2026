import { useEffect, useState } from "react";
import { type PracticeProfile, SignedOutError, fetchProfile } from "./profile";

export type ProfileState = { phase: "loading" } | { phase: "ready"; profile: PracticeProfile } | { phase: "unavailable" };

export function usePracticeProfile(token: string, onSignedOut: () => void) {
  const [state, setState] = useState<ProfileState>({ phase: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchProfile(token, controller.signal).then(
      (profile) => setState({ phase: "ready", profile }),
      (error) => {
        if (controller.signal.aborted) return;
        if (error instanceof SignedOutError) onSignedOut();
        // the menu still works without the profile, it just can't greet the person
        else setState({ phase: "unavailable" });
      },
    );
    return () => controller.abort();
  }, [token, onSignedOut]);

  return state;
}
