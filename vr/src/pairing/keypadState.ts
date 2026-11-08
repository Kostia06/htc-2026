import type { ClaimProblem, HeadsetSession } from "./api";

export const CODE_LENGTH = 4;

export type KeypadState =
  | { phase: "entering"; digits: string; notice: ClaimProblem | null; shakes: number }
  | { phase: "checking"; digits: string; shakes: number }
  | { phase: "signedIn"; session: HeadsetSession };

export type KeypadEvent =
  | { type: "digit"; digit: string }
  | { type: "backspace" }
  | { type: "claimed"; session: HeadsetSession }
  | { type: "failed"; problem: ClaimProblem };

export const initialKeypadState: KeypadState = { phase: "entering", digits: "", notice: null, shakes: 0 };

export function reduceKeypad(state: KeypadState, event: KeypadEvent): KeypadState {
  switch (event.type) {
    case "digit": {
      if (state.phase !== "entering" || !/^\d$/.test(event.digit)) return state;
      const digits = state.digits + event.digit;
      // the fourth digit sends the code: no submit button to aim a controller at
      if (digits.length === CODE_LENGTH) return { phase: "checking", digits, shakes: state.shakes };
      return { ...state, digits, notice: null };
    }
    case "backspace":
      return state.phase === "entering" ? { ...state, digits: state.digits.slice(0, -1), notice: null } : state;
    case "claimed":
      return state.phase === "checking" ? { phase: "signedIn", session: event.session } : state;
    case "failed": {
      if (state.phase !== "checking") return state;
      // only a wrong code shakes; a network problem says nothing about the digits
      const shakes = event.problem === "wrong" ? state.shakes + 1 : state.shakes;
      return { phase: "entering", digits: "", notice: event.problem, shakes };
    }
  }
}
