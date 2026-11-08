import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, readSession, saveSession } from "./storage";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe("remembering the session", () => {
  beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips the whole session and forgets it on sign-out", () => {
    const session = { token: "t1", expiresAt: "2026-11-07T11:00:00.000Z", refreshToken: "dev.secret", deviceId: "dev", deviceName: "Quest 3" };
    saveSession(session);
    expect(readSession()).toEqual(session);
    clearSession();
    expect(readSession()).toBeNull();
  });

  it("picks up a token stored by the page before sessions were remembered, with the expiry it carries", () => {
    const expiresAtSeconds = Math.floor(Date.parse("2026-11-07T22:00:00Z") / 1000);
    localStorage.setItem("raven.sessionToken", `user-1.${expiresAtSeconds}.sig`);
    expect(readSession()).toEqual({ token: `user-1.${expiresAtSeconds}.sig`, expiresAt: "2026-11-07T22:00:00.000Z" });
    // the old key goes once a remembered session replaces it
    saveSession({ token: "t2", expiresAt: "2026-11-08T00:00:00.000Z" });
    expect(localStorage.getItem("raven.sessionToken")).toBeNull();
  });

  it("ignores garbage and a storage that throws", () => {
    localStorage.setItem("raven.headset", "{not json");
    expect(readSession()).toBeNull();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readSession()).toBeNull();
  });
});
