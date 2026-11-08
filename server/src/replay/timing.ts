import type { StoredTurn } from "../voice/store";
import type { Span } from "./align";

// playback starts this far before the answer, so the first words aren't clipped by clock drift or a slow seek
export const LEAD_IN_SEC = 1.5;

export const withLeadIn = (seconds: number) => Math.max(0, seconds - LEAD_IN_SEC);

/** True when every answer was timestamped live, so no transcript matching is needed. */
export const hasLiveTimestamps = (turns: StoredTurn[]) => turns.length > 0 && turns.every((turn) => turn.answerStartSec !== undefined);

/**
 * Where each answer happened, straight from the client's clock: from just before the person started speaking
 * until the next answer starts, or the end of the call.
 */
export function liveSpans(turns: StoredTurn[], durationSec: number): Span[] {
  return turns.map((turn, i) => {
    const next = turns[i + 1]?.answerStartSec;
    const end = next ?? Math.max(durationSec, turn.atSec ?? 0);
    return { start: withLeadIn(turn.answerStartSec ?? 0), end };
  });
}

/** The call's length when the recording's own length isn't known yet. */
export const lastTimestamp = (turns: StoredTurn[]) => Math.max(0, ...turns.map((turn) => turn.atSec ?? turn.answerStartSec ?? 0));
