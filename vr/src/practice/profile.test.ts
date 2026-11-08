import { afterEach, describe, expect, it, vi } from "vitest";
import { SignedOutError, fetchProfile } from "./profile";

const answer = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const signal = new AbortController().signal;

afterEach(() => vi.unstubAllGlobals());

describe("the person's profile", () => {
  it("asks with the headset's token and keeps what the menu shows", async () => {
    const fetch = answer(200, { profile: { headline: "CS student", targetRoles: ["Junior data analyst"], skills: [] } });
    vi.stubGlobal("fetch", fetch);
    expect(await fetchProfile("t0k", signal)).toEqual({ headline: "CS student", targetRoles: ["Junior data analyst"] });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toEqual({ Authorization: "Bearer t0k" });
  });

  it("treats a missing list as empty", async () => {
    vi.stubGlobal("fetch", answer(200, { profile: {} }));
    expect(await fetchProfile("t0k", signal)).toEqual({ headline: undefined, targetRoles: [] });
  });

  it("signs the headset out when its token has expired", async () => {
    vi.stubGlobal("fetch", answer(401));
    await expect(fetchProfile("old", signal)).rejects.toBeInstanceOf(SignedOutError);
  });
});
