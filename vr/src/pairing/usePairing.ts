import { useEffect, useReducer } from "react";
import { checkPairing, createPairing, problemOf } from "./api";
import { POLL_INTERVAL_MS, initialPairingState, reducePairing, retryDelayFor } from "./pairingState";
import { pollEvery } from "./pollEvery";
import { usePageVisible } from "./usePageVisible";

export function usePairing() {
  const [state, dispatch] = useReducer(reducePairing, initialPairingState);
  const isVisible = usePageVisible();
  const pairing = state.phase === "waiting" ? state.pairing : null;
  const deadline = state.phase === "waiting" ? state.deadline : null;
  const problem = state.phase === "failed" ? state.problem : null;

  // a hidden tab (headset off, another tab open) asks for nothing, so it can't burn through the code limit
  useEffect(() => {
    if (state.phase !== "requesting" || !isVisible) return;
    const controller = new AbortController();
    createPairing(controller.signal).then(
      (created) => dispatch({ type: "created", pairing: created, receivedAt: Date.now() }),
      (error) => {
        if (!controller.signal.aborted) dispatch({ type: "createFailed", problem: problemOf(error) });
      },
    );
    return () => controller.abort();
  }, [state.phase, isVisible]);

  useEffect(() => {
    if (!pairing || !isVisible) return;
    return pollEvery(POLL_INTERVAL_MS, async (signal) => {
      try {
        dispatch({ type: "polled", code: pairing.code, result: await checkPairing(pairing, signal) });
      } catch {
        if (!signal.aborted) dispatch({ type: "pollFailed", code: pairing.code });
      }
    });
  }, [pairing, isVisible]);

  useEffect(() => {
    if (!pairing || deadline === null) return;
    const timer = setTimeout(() => dispatch({ type: "timedOut", code: pairing.code }), deadline - Date.now());
    return () => clearTimeout(timer);
  }, [pairing, deadline]);

  useEffect(() => {
    if (!problem) return;
    const retry = () => dispatch({ type: "retry" });
    const timer = setTimeout(retry, retryDelayFor(problem));
    window.addEventListener("online", retry);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", retry);
    };
  }, [problem]);

  return { state, retry: () => dispatch({ type: "retry" }) };
}
