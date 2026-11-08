import "./pairing.css";
import { useEffect } from "react";
import type { ClaimProblem, HeadsetSession } from "./api";
import { DigitBoxes } from "./DigitBoxes";
import { Keypad } from "./Keypad";
import { useKeypad } from "./useKeypad";

// long enough to read "signed in" before the screen changes, short enough not to feel like waiting
const SUCCESS_PAUSE_MS = 700;

const NOTICE_COPY: Record<ClaimProblem, string> = {
  wrong: "That code isn't right. Check your phone and try again.",
  rate_limited: "Too many wrong codes. Wait a few minutes, then try again.",
  offline: "This headset is offline. Check its Wi-Fi, then enter the code again.",
  unavailable: "Skillit isn't answering. Enter the code again in a moment.",
};

export function PairingScreen({ onSignIn }: { onSignIn: (session: HeadsetSession) => void }) {
  const { state, press, backspace } = useKeypad();
  const signedInSession = state.phase === "signedIn" ? state.session : null;

  useEffect(() => {
    if (!signedInSession) return;
    const timer = setTimeout(() => onSignIn(signedInSession), SUCCESS_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [signedInSession, onSignIn]);

  if (state.phase === "signedIn") {
    return (
      <main className="screen centered">
        <h1>You're signed in</h1>
        <p className="lead">Opening Skillit</p>
      </main>
    );
  }

  const isChecking = state.phase === "checking";
  const notice = state.phase === "entering" ? state.notice : null;

  return (
    <main className="screen pairing">
      <p className="wordmark">Skillit</p>
      <div className="pairing-layout">
        <section className="pairing-details">
          <h1>Sign in to Skillit</h1>
          <p className="lead">
            On your phone, open Skillit, go to Practice, then <strong>Practice in VR</strong>. Enter the 4 digits it shows.
          </p>
          <DigitBoxes digits={state.digits} isChecking={isChecking} isWrong={notice === "wrong"} shakes={state.shakes} />
          <p className={notice ? "pairing-status is-problem" : "pairing-status"} aria-live="polite">
            {isChecking ? "Checking the code" : notice ? NOTICE_COPY[notice] : " "}
          </p>
        </section>
        <Keypad isDisabled={isChecking} onDigit={press} onBackspace={backspace} />
      </div>
    </main>
  );
}
