import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/index";
import { issueSession, verifySession } from "../../src/auth/session";

type Created = { code: string; pollToken: string; expiresAt: string; link: string };

const request = (path: string, init: RequestInit = {}) => app.request(path, init, env);

async function newHeadset() {
  const res = await request("/api/pairing", { method: "POST", headers: { "CF-Connecting-IP": crypto.randomUUID() } });
  expect(res.status).toBe(201);
  return res.json<Created>();
}

async function signedInPhone() {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, userId: (await verifySession(token, env.SESSION_SECRET))! };
}

const approve = (code: string, token: string) => request(`/api/pairing/${code}/approve`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
const poll = (code: string, pollToken: string) => request(`/api/pairing/${code}`, { headers: { "X-Pairing-Token": pollToken } });

describe("headset pairing", () => {
  it("gives the headset a QR code that needs no sign-in", async () => {
    const headset = await newHeadset();
    expect(headset.code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(headset.link).toBe(`raven://pair?code=${headset.code}`);
    expect(await (await poll(headset.code, headset.pollToken)).json()).toEqual({ status: "pending" });
  });

  it("signs the headset into the account of the phone that scanned it, once", async () => {
    const headset = await newHeadset();
    const phone = await signedInPhone();
    expect((await approve(headset.code, phone.token)).status).toBe(200);

    const first = await (await poll(headset.code, headset.pollToken)).json<{ status: string; token: string }>();
    expect(first.status).toBe("approved");
    expect(await verifySession(first.token, env.SESSION_SECRET)).toBe(phone.userId);
    expect((await poll(headset.code, headset.pollToken)).status).toBe(410);
  });

  it("only hands the token to the headset that made the code", async () => {
    const headset = await newHeadset();
    await approve(headset.code, (await signedInPhone()).token);
    expect((await poll(headset.code, "someone-elses-token")).status).toBe(404);
  });

  it("needs a signed-in phone and refuses a code that was already approved", async () => {
    const headset = await newHeadset();
    expect((await approve(headset.code, "not-a-token")).status).toBe(401);
    expect((await approve(headset.code, (await signedInPhone()).token)).status).toBe(200);
    expect((await approve(headset.code, (await signedInPhone()).token)).status).toBe(409);
  });

  it("expires codes after five minutes", async () => {
    const headset = await newHeadset();
    await env.DB.prepare("UPDATE device_pairings SET expires_at = ? WHERE code = ?").bind(new Date(Date.now() - 1000).toISOString(), headset.code).run();
    expect((await approve(headset.code, (await signedInPhone()).token)).status).toBe(410);
    expect((await poll(headset.code, headset.pollToken)).status).toBe(410);
  });

  it("limits how many codes one network can make", async () => {
    const ip = { "CF-Connecting-IP": "203.0.113.9" };
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await request("/api/pairing", { method: "POST", headers: ip })).status);
    expect(statuses.at(-1)).toBe(429);
  });
});
