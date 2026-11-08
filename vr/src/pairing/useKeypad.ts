import { useEffect, useReducer } from "react";
import { claimCode, problemOf } from "./api";
import { initialKeypadState, reduceKeypad } from "./keypadState";

export function useKeypad() {
  const [state, dispatch] = useReducer(reduceKeypad, initialKeypadState);
  const checkingCode = state.phase === "checking" ? state.digits : null;

  useEffect(() => {
    if (!checkingCode) return;
    claimCode(checkingCode).then(
      ({ token }) => dispatch({ type: "claimed", token }),
      (error) => dispatch({ type: "failed", problem: problemOf(error) }),
    );
  }, [checkingCode]);

  // a keyboard works too: handy on a desktop, and some Quest users pair a Bluetooth one
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Backspace") dispatch({ type: "backspace" });
      else if (/^\d$/.test(event.key)) dispatch({ type: "digit", digit: event.key });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return {
    state,
    press: (digit: string) => dispatch({ type: "digit", digit }),
    backspace: () => dispatch({ type: "backspace" }),
  };
}
