import { afterEach, describe, expect, it, vi } from "vitest";
import { NetworkError } from "../session/http";
import { SignedOutError, pollLaunch, refreshSession } from "./api";

const answer = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const session = { token: "t1", expiresAt: "2026-11-07T11:00:00Z", refreshToken: "dev.secret", deviceId: "dev" };

afterEach(() => vi.unstubAllGlobals());

describe("refreshing", () => {
  it("posts the refresh credential and returns the new session", async () => {
    const next = { ...session, token: "t2", refreshToken: "dev.next" };
    const fetch = answer(200, next);
    vi.stubGlobal("fetch", fetch);
    expect(await refreshSession("dev.secret")).toEqual(next);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/headset\/refresh$/);
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: "dev.secret" });
  });

  it("tells a rejected credential apart from a server that's down", async () => {
    vi.stubGlobal("fetch", answer(401));
    await expect(refreshSession("dev.spent")).rejects.toBeInstanceOf(SignedOutError);
    vi.stubGlobal("fetch", answer(503));
    await expect(refreshSession("dev.secret")).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("polling for a launch", () => {
  it("long-polls as this device with the access token and returns what the phone sent", async () => {
    const fetch = answer(200, { launch: { mode: "interview", companySlug: "atb" } });
    vi.stubGlobal("fetch", fetch);
    expect(await pollLaunch(session, new AbortController().signal)).toEqual({ mode: "interview", companySlug: "atb" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/headset\/launch\?wait=20&device=dev$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t1");
  });

  it("returns null when the wait ran out, and signs out on a 401", async () => {
    vi.stubGlobal("fetch", answer(200, { launch: null }));
    expect(await pollLaunch(session, new AbortController().signal)).toBeNull();
    vi.stubGlobal("fetch", answer(401));
    await expect(pollLaunch(session, new AbortController().signal)).rejects.toBeInstanceOf(SignedOutError);
  });
});
