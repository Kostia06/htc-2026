import { useCallback, useEffect, useState } from "react";
import type { HeadsetSession } from "../pairing/api";
import { SignedOutError, refreshSession } from "./api";
import { RETRY_AFTER_FAILURE_MS, type HeadsetState, type RefreshOutcome, afterRefresh, initialState, refreshDelayMs } from "./session";
import { clearSession, readSession, saveSession } from "./storage";

async function tryRefresh(refreshToken: string): Promise<RefreshOutcome> {
  try {
    return { kind: "refreshed", session: await refreshSession(refreshToken) };
  } catch (error) {
    return error instanceof SignedOutError ? { kind: "rejected" } : { kind: "unreachable" };
  }
}

/**
 * Keeps the headset signed in: restores the stored session on load, refreshes the access token before it
 * ends, and only goes back to the keypad when the server rejects the refresh credential (revoked or spent).
 */
export function useHeadsetSession() {
  const [state, setState] = useState<HeadsetState>(() => initialState(readSession(), new Date()));
  // failed refreshes in a row; bumping it re-arms the timer below
  const [failures, setFailures] = useState(0);

  const signIn = useCallback((session: HeadsetSession) => {
    saveSession(session);
    setState({ phase: "signedIn", session });
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setState({ phase: "signedOut" });
  }, []);

  const session = state.phase === "signedOut" ? null : state.session;
  const refreshToken = session?.refreshToken;
  const expiresAt = session?.expiresAt;
  // without a live token there's nothing to show, so refresh right away (and keep trying while Raven is unreachable)
  const isUrgent = state.phase === "restoring" || state.phase === "reconnecting";

  useEffect(() => {
    if (!refreshToken || !expiresAt) return;
    const scheduled = refreshDelayMs({ token: "", expiresAt, refreshToken }, new Date()) ?? 0;
    const delay = isUrgent ? (failures === 0 ? 0 : RETRY_AFTER_FAILURE_MS) : scheduled;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const outcome = await tryRefresh(refreshToken);
      if (cancelled) return;
      if (outcome.kind === "refreshed") saveSession(outcome.session);
      if (outcome.kind === "rejected") clearSession();
      setFailures((count) => (outcome.kind === "unreachable" ? count + 1 : 0));
      setState((current) => afterRefresh(current, outcome, new Date()));
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refreshToken, expiresAt, isUrgent, failures]);

  return { state, signIn, signOut };
}
