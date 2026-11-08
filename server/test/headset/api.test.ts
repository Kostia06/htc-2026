import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { offerCode } from "../../src/auth/pairing";
import { issueSessionFor } from "../../src/auth/session";
import { deps } from "../../src/headset/launch";
import app from "../../src/index";

type Creds = { token: string; expiresAt: string; refreshToken: string; refreshExpiresAt: string; deviceId: string; deviceName: string };

const QUEST_UA = "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 OculusBrowser/35.0";

const json = (method: string, body: unknown, token?: string, headers: Record<string, string> = {}) => ({
  method,
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  body: JSON.stringify(body),
});
const asPhone = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

async function pairHeadset(userId: string) {
  const { code } = await offerCode(env, userId);
  const res = await app.request("/api/pairing/claim", json("POST", { code }, undefined, { "User-Agent": QUEST_UA }), env);
  expect(res.status).toBe(200);
  return res.json<Creds>();
}

describe("headset routes", () => {
  const phone = issueSessionFor(env.SESSION_SECRET, "alice");

  beforeEach(async () => {
    vi.spyOn(deps, "sleep").mockResolvedValue();
    await env.DB.batch([env.DB.prepare("DELETE FROM headset_devices"), env.DB.prepare("DELETE FROM headset_launches"), env.DB.prepare("DELETE FROM pairing_offers")]);
  });

  it("claiming a code registers the headset and hands back a refresh credential too", async () => {
    const creds = await pairHeadset("alice");
    expect(creds).toMatchObject({ deviceName: "Quest 3" });
    expect(creds.token).toBeTruthy();
    expect(creds.refreshToken).toBeTruthy();

    const res = await app.request("/api/headset/devices", asPhone(await phone), env);
    expect(res.status).toBe(200);
    const { devices } = await res.json<{ devices: { id: string; name: string; connected: boolean }[] }>();
    expect(devices).toEqual([expect.objectContaining({ id: creds.deviceId, name: "Quest 3", connected: true })]);
  });

  it("refreshes without a session and rejects a spent or made-up credential", async () => {
    const creds = await pairHeadset("alice");
    const res = await app.request("/api/headset/refresh", json("POST", { refreshToken: creds.refreshToken }), env);
    expect(res.status).toBe(200);
    const next = await res.json<Creds>();
    expect(next.deviceId).toBe(creds.deviceId);
    expect(next.refreshToken).not.toBe(creds.refreshToken);

    expect((await app.request("/api/headset/refresh", json("POST", { refreshToken: creds.refreshToken }), env)).status).toBe(401);
    expect((await app.request("/api/headset/refresh", json("POST", {}), env)).status).toBe(400);
    // the new access token signs the headset in
    expect((await app.request("/api/me/profile", asPhone(next.token), env)).status).toBe(200);
  });

  it("queues a launch on the phone and hands it to the headset's poll once", async () => {
    const creds = await pairHeadset("alice");
    const sent = await app.request("/api/headset/launch", json("POST", { mode: "interview", companySlug: "atb", stepId: "s1" }, await phone), env);
    expect(sent.status).toBe(201);
    expect(await sent.json()).toMatchObject({ connected: true });

    const poll = await app.request(`/api/headset/launch?device=${creds.deviceId}`, asPhone(creds.token), env);
    expect(poll.status).toBe(200);
    expect(await poll.json()).toEqual({ launch: { mode: "interview", companySlug: "atb", stepId: "s1" } });

    // polling again within a second is refused
    expect((await app.request(`/api/headset/launch?device=${creds.deviceId}`, asPhone(creds.token), env)).status).toBe(429);
    // a second later the long poll is welcome, and finds nothing left
    await env.DB.prepare("DELETE FROM cooldowns WHERE scope = 'headset-poll'").run();
    const again = await app.request(`/api/headset/launch?device=${creds.deviceId}&wait=20`, asPhone(creds.token), env);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ launch: null });
  });

  it("refuses a bad launch and a poll from a revoked headset", async () => {
    const creds = await pairHeadset("alice");
    expect((await app.request("/api/headset/launch", json("POST", { mode: "karaoke" }, await phone), env)).status).toBe(400);

    expect((await app.request(`/api/headset/devices/${creds.deviceId}`, { method: "DELETE", ...asPhone(await phone) }, env)).status).toBe(200);
    expect((await app.request(`/api/headset/devices/${creds.deviceId}`, { method: "DELETE", ...asPhone(await phone) }, env)).status).toBe(404);
    expect((await app.request(`/api/headset/launch?device=${creds.deviceId}`, asPhone(creds.token), env)).status).toBe(401);
  });

  it("still serves a headset holding an older token without a device id", async () => {
    const legacy = await issueSessionFor(env.SESSION_SECRET, "alice");
    await app.request("/api/headset/launch", json("POST", { mode: "networking" }, await phone), env);
    const poll = await app.request("/api/headset/launch", asPhone(legacy), env);
    expect(poll.status).toBe(200);
    expect(await poll.json()).toEqual({ launch: { mode: "networking" } });
  });

  it("reports whether a headset is connected", async () => {
    let res = await app.request("/api/headset/status", asPhone(await phone), env);
    expect(await res.json()).toEqual({ connected: false, devices: [] });
    await pairHeadset("alice");
    res = await app.request("/api/headset/status", asPhone(await phone), env);
    expect(await res.json()).toMatchObject({ connected: true });
  });
});
