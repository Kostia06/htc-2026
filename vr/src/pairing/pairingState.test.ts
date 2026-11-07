import { describe, expect, it } from "vitest";
import type { Pairing } from "./api";
import { type PairingState, initialPairingState, reducePairing, retryDelayFor } from "./pairingState";

const receivedAt = Date.parse("2026-11-07T12:00:00Z");
const pairing: Pairing = { code: "K7M2Q9XD", pollToken: "secret", expiresAt: "2026-11-07T12:05:00Z", link: "raven://pair?code=K7M2Q9XD" };
const waiting = reducePairing(initialPairingState, { type: "created", pairing, receivedAt });

describe("reducePairing", () => {
  it("shows a new code and its deadline once created", () => {
    expect(waiting).toEqual({ phase: "waiting", pairing, deadline: receivedAt + 300_000, isConnectionLost: false });
  });

  it("keeps waiting while the phone has not approved", () => {
    expect(reducePairing(waiting, { type: "polled", code: pairing.code, result: { status: "pending" } })).toBe(waiting);
  });

  it("signs in when the phone approves", () => {
    const next = reducePairing(waiting, { type: "polled", code: pairing.code, result: { status: "approved", token: "session" } });
    expect(next).toEqual({ phase: "approved", token: "session" });
  });

  it("asks for a fresh code when the server or the countdown says this one is done", () => {
    expect(reducePairing(waiting, { type: "polled", code: pairing.code, result: { status: "expired" } })).toEqual(initialPairingState);
    expect(reducePairing(waiting, { type: "timedOut", code: pairing.code })).toEqual(initialPairingState);
  });

  it("ignores late answers about a code it already replaced", () => {
    const approvedOld = reducePairing(waiting, { type: "polled", code: "OLDCODE2", result: { status: "approved", token: "stale" } });
    expect(approvedOld).toBe(waiting);
    expect(reducePairing(waiting, { type: "timedOut", code: "OLDCODE2" })).toBe(waiting);
  });

  it("flags a lost connection without dropping the code, and clears it on the next answer", () => {
    const lost = reducePairing(waiting, { type: "pollFailed", code: pairing.code });
    expect(lost).toEqual({ ...waiting, isConnectionLost: true });
    expect(reducePairing(lost, { type: "polled", code: pairing.code, result: { status: "pending" } })).toEqual(waiting);
  });

  it("shows the problem when a code can't be created, then retries", () => {
    const failed = reducePairing(initialPairingState, { type: "createFailed", problem: "rate_limited" });
    expect(failed).toEqual({ phase: "failed", problem: "rate_limited" });
    expect(reducePairing(failed, { type: "retry" })).toEqual(initialPairingState);
  });

  it("never leaves a signed-in state", () => {
    const approved: PairingState = { phase: "approved", token: "session" };
    expect(reducePairing(approved, { type: "retry" })).toBe(approved);
    expect(reducePairing(approved, { type: "created", pairing, receivedAt })).toBe(approved);
  });
});

describe("retryDelayFor", () => {
  it("backs off longer when the server says too many codes", () => {
    expect(retryDelayFor("rate_limited")).toBeGreaterThan(retryDelayFor("offline"));
  });
});
