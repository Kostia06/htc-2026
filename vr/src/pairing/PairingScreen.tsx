import "./pairing.css";
import { useEffect } from "react";
import type { PairingProblem } from "./api";
import { formatCode } from "./code";
import { Countdown } from "./Countdown";
import type { PairingState } from "./pairingState";
import { QrCode } from "./QrCode";
import { usePairing } from "./usePairing";

// long enough to read "signed in" before the screen changes
const SUCCESS_PAUSE_MS = 1200;

const PROBLEM_COPY: Record<PairingProblem, string> = {
  offline: "This headset is offline. Check its Wi-Fi and we'll try again.",
  rate_limited: "Too many new codes in a row. We'll try again in half a minute.",
  unavailable: "Raven isn't answering right now. We'll try again in a few seconds.",
};

export function PairingScreen({ onSignIn }: { onSignIn: (token: string) => void }) {
  const { state, retry } = usePairing();
  const approvedToken = state.phase === "approved" ? state.token : null;

  useEffect(() => {
    if (!approvedToken) return;
    const timer = setTimeout(() => onSignIn(approvedToken), SUCCESS_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [approvedToken, onSignIn]);

  if (state.phase === "approved") {
    return (
      <main className="screen centered">
        <h1>You're signed in</h1>
        <p className="lead">Opening Raven</p>
      </main>
    );
  }

  return (
    <main className="screen pairing">
      <p className="wordmark">Raven</p>
      <div className="pairing-layout">
        <div className="qr-frame">
          {state.phase === "waiting" ? <QrCode value={state.pairing.link} label="Sign-in QR code" /> : <p className="qr-placeholder">{state.phase === "failed" ? "No code yet" : "Getting a code"}</p>}
        </div>
        <section className="pairing-details">
          <h1>Sign in to Raven</h1>
          <p className="lead">Scan with the Raven app on your phone</p>
          <PairingDetails state={state} onRetry={retry} />
        </section>
      </div>
    </main>
  );
}

function PairingDetails({ state, onRetry }: { state: PairingState; onRetry: () => void }) {
  if (state.phase === "failed") {
    return (
      <div className="problem" role="alert">
        <p>{PROBLEM_COPY[state.problem]}</p>
        <button className="button primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  if (state.phase !== "waiting") return null;

  return (
    <>
      <p className="code-label">Or type this code in the app</p>
      <p className="code" aria-label={state.pairing.code.split("").join(" ")}>
        {formatCode(state.pairing.code)}
      </p>
      <p className="status" aria-live="polite">
        {state.isConnectionLost ? (
          <span className="status-warning">Can't reach Raven. Still trying.</span>
        ) : (
          <span className="status-live">
            <span className="live-dot" aria-hidden="true" />
            Waiting for your phone
          </span>
        )}
        <Countdown deadline={state.deadline} />
      </p>
    </>
  );
}
