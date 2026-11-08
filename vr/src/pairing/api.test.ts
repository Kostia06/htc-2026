import { afterEach, describe, expect, it, vi } from "vitest";
import { claimCode, problemOf } from "./api";

const answer = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("claiming a code", () => {
  it("sends the code and returns the headset's token", async () => {
    const fetch = answer(200, { token: "t0k", expiresAt: "2026-11-08T00:00:00Z" });
    vi.stubGlobal("fetch", fetch);
    expect(await claimCode("4821")).toEqual({ token: "t0k", expiresAt: "2026-11-08T00:00:00Z" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/pairing\/claim$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ code: "4821" });
  });

  it.each([
    [404, "wrong"],
    [400, "wrong"],
    [429, "rate_limited"],
    [500, "unavailable"],
  ])("reads a %i as %s", async (status, problem) => {
    vi.stubGlobal("fetch", answer(status));
    expect(problemOf(await claimCode("4821").catch((error: unknown) => error))).toBe(problem);
  });

  it("tells a dead network apart from a server it can't reach", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("network"))));
    vi.stubGlobal("navigator", { onLine: false });
    expect(problemOf(await claimCode("4821").catch((error: unknown) => error))).toBe("offline");
    vi.stubGlobal("navigator", { onLine: true });
    expect(problemOf(await claimCode("4821").catch((error: unknown) => error))).toBe("unavailable");
  });
});
