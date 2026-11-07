import type { Pairing, PairingProblem, PollResult } from "./api";
import { deadlineFor } from "./code";

export const POLL_INTERVAL_MS = 2000;

export type PairingState =
  | { phase: "requesting" }
  | { phase: "waiting"; pairing: Pairing; deadline: number; isConnectionLost: boolean }
  | { phase: "approved"; token: string }
  | { phase: "failed"; problem: PairingProblem };

export type PairingEvent =
  | { type: "created"; pairing: Pairing; receivedAt: number }
  | { type: "createFailed"; problem: PairingProblem }
  | { type: "polled"; code: string; result: PollResult }
  | { type: "pollFailed"; code: string }
  | { type: "timedOut"; code: string }
  | { type: "retry" };

export const initialPairingState: PairingState = { phase: "requesting" };

export function retryDelayFor(problem: PairingProblem) {
  return problem === "rate_limited" ? 30_000 : 5_000;
}

// answers can arrive for a code the headset already replaced, so code-specific events are checked against the current one
const isAbout = (state: PairingState, code: string): state is Extract<PairingState, { phase: "waiting" }> =>
  state.phase === "waiting" && state.pairing.code === code;

export function reducePairing(state: PairingState, event: PairingEvent): PairingState {
  switch (event.type) {
    case "created":
      if (state.phase !== "requesting") return state;
      return { phase: "waiting", pairing: event.pairing, deadline: deadlineFor(event.pairing.expiresAt, event.receivedAt), isConnectionLost: false };
    case "createFailed":
      return state.phase === "requesting" ? { phase: "failed", problem: event.problem } : state;
    case "polled":
      if (!isAbout(state, event.code)) return state;
      if (event.result.status === "approved") return { phase: "approved", token: event.result.token };
      if (event.result.status === "expired") return initialPairingState;
      return state.isConnectionLost ? { ...state, isConnectionLost: false } : state;
    case "pollFailed":
      return isAbout(state, event.code) && !state.isConnectionLost ? { ...state, isConnectionLost: true } : state;
    case "timedOut":
      return isAbout(state, event.code) ? initialPairingState : state;
    case "retry":
      return state.phase === "failed" ? initialPairingState : state;
  }
}
