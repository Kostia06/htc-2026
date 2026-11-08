import type { StoredTurn } from "../store";
import type { LiveTip } from "./types";

export type ReportTip = LiveTip & { turn: number; question: string };

/** The tips written during the call, in answer order, for the draft and the final report. */
export function liveTipsOf(turns: StoredTurn[]): ReportTip[] {
  return turns.flatMap((turn, i) => (turn.liveTip ? [{ ...turn.liveTip, turn: i, question: turn.question }] : []));
}

// the tips come from the turns, not the model, so a draft built before a tip landed still shows it when read;
// left off entirely when there are none, so a session without tips reads exactly as before
export function withLiveTips<T extends object>(report: T, turns: StoredTurn[]): T & { liveTips?: ReportTip[] } {
  const liveTips = liveTipsOf(turns);
  return liveTips.length > 0 ? { ...report, liveTips } : report;
}
