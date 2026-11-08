import { describe, expect, it } from "vitest";
import { REFRESH_MARGIN_MS, afterRefresh, initialState, refreshDelayMs } from "./session";

const NOW = new Date("2026-11-07T10:00:00Z");
const inMinutes = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const remembered = { token: "t1", expiresAt: inMinutes(60), refreshToken: "dev.secret", deviceId: "dev", deviceName: "Quest 3" };
const legacy = { token: "t0", expiresAt: inMinutes(60) };

describe("the headset's session on load", () => {
  it("starts at the keypad with nothing stored", () => {
    expect(initialState(null, NOW)).toEqual({ phase: "signedOut" });
  });

  it("shows the menu at once while the stored token is still good", () => {
    expect(initialState(remembered, NOW)).toEqual({ phase: "signedIn", session: remembered });
    expect(initialState(legacy, NOW)).toEqual({ phase: "signedIn", session: legacy });
  });

  it("restores a remembered headset whose token ran out, but ends an older session", () => {
    const expired = { ...remembered, expiresAt: inMinutes(-1) };
    expect(initialState(expired, NOW)).toEqual({ phase: "restoring", session: expired });
    expect(initialState({ ...legacy, expiresAt: inMinutes(-1) }, NOW)).toEqual({ phase: "signedOut" });
  });
});

describe("refreshing before the token ends", () => {
  it("refreshes five minutes early, never sooner than ten seconds, and never for a session without a credential", () => {
    expect(refreshDelayMs(remembered, NOW)).toBe(60 * 60_000 - REFRESH_MARGIN_MS);
    expect(refreshDelayMs({ ...remembered, expiresAt: inMinutes(1) }, NOW)).toBe(10_000);
    expect(refreshDelayMs(legacy, NOW)).toBeNull();
  });

  it("swaps in the new session, goes to the keypad only when rejected, and waits out a dead network", () => {
    const signedIn = initialState(remembered, NOW);
    const next = { ...remembered, token: "t2", refreshToken: "dev.next" };
    expect(afterRefresh(signedIn, { kind: "refreshed", session: next }, NOW)).toEqual({ phase: "signedIn", session: next });
    expect(afterRefresh(signedIn, { kind: "rejected" }, NOW)).toEqual({ phase: "signedOut" });
    expect(afterRefresh(signedIn, { kind: "unreachable" }, NOW)).toEqual(signedIn);

    const expired = { ...remembered, expiresAt: inMinutes(-1) };
    expect(afterRefresh({ phase: "restoring", session: expired }, { kind: "unreachable" }, NOW)).toEqual({ phase: "reconnecting", session: expired });
    expect(afterRefresh({ phase: "reconnecting", session: expired }, { kind: "refreshed", session: next }, NOW)).toEqual({ phase: "signedIn", session: next });
  });
});
