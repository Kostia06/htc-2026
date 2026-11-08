import type { HeadsetSession } from "../pairing/api";

export type HeadsetState =
  // a stored refresh credential is being traded for a fresh token before anything shows
  | { phase: "restoring"; session: HeadsetSession }
  | { phase: "signedOut" }
  | { phase: "signedIn"; session: HeadsetSession }
  // the token ran out and Raven can't be reached to refresh it; the credential is kept for the retry
  | { phase: "reconnecting"; session: HeadsetSession };

export type RefreshOutcome = { kind: "refreshed"; session: HeadsetSession } | { kind: "rejected" } | { kind: "unreachable" };

// refresh this long before the access token ends, so a slow network never leaves a gap
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;
export const RETRY_AFTER_FAILURE_MS = 30_000;
// never refresh in a tight loop, whatever the server put in expiresAt
const MIN_REFRESH_DELAY_MS = 10_000;

export const isLive = (session: HeadsetSession, now: Date) => Date.parse(session.expiresAt) > now.getTime();

/** What to show first, given what the last visit left in storage. */
export function initialState(stored: HeadsetSession | null, now: Date): HeadsetState {
  if (!stored) return { phase: "signedOut" };
  if (isLive(stored, now)) return { phase: "signedIn", session: stored };
  // an older session without a refresh credential just ends when its token does
  return stored.refreshToken ? { phase: "restoring", session: stored } : { phase: "signedOut" };
}

/** How long to wait before refreshing; null when the session has nothing to refresh with. */
export function refreshDelayMs(session: HeadsetSession, now: Date): number | null {
  if (!session.refreshToken) return null;
  return Math.max(Date.parse(session.expiresAt) - now.getTime() - REFRESH_MARGIN_MS, MIN_REFRESH_DELAY_MS);
}

/** Only a refresh the server rejected sends the headset back to the keypad; a network failure keeps the credential and waits. */
export function afterRefresh(state: HeadsetState, outcome: RefreshOutcome, now: Date): HeadsetState {
  if (outcome.kind === "refreshed") return { phase: "signedIn", session: outcome.session };
  if (outcome.kind === "rejected") return { phase: "signedOut" };
  if (state.phase === "signedOut") return state;
  return isLive(state.session, now) ? { phase: "signedIn", session: state.session } : { phase: "reconnecting", session: state.session };
}
