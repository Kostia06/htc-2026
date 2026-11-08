import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../src/index";
import { issueSession, verifySession } from "../../src/auth/session";

type Offer = { code: string; expiresAt: string };
type Claimed = { token: string; expiresAt: string };

const request = (path: string, init: RequestInit = {}) => app.request(path, init, env);

async function signedInPhone() {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, userId: (await verifySession(token, env.SESSION_SECRET))! };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function offer(phoneToken: string) {
  const res = await request("/api/pairing/offer", { method: "POST", headers: bearer(phoneToken) });
  expect(res.status).toBe(201);
  return res.json<Offer>();
}

const claim = (code: string, ip: string = crypto.randomUUID()) =>
  request("/api/pairing/claim", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify({ code }) });

const status = async (code: string, phoneToken: string) => {
  const res = await request(`/api/pairing/offer/${code}`, { headers: bearer(phoneToken) });
  return res.json<{ status: string }>();
};

const otherCodeThan = (code: string) => String((Number(code) + 1) % 10_000).padStart(4, "0");

describe("headset pairing", () => {
  // a wrong guess must not land on some other test's live code
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM pairing_offers").run();
  });

  it("gives a signed-in phone a 4-digit code that lives two minutes", async () => {
    const before = Date.now();
    const { code, expiresAt } = await offer((await signedInPhone()).token);
    expect(code).toMatch(/^\d{4}$/);
    const lifetime = Date.parse(expiresAt) - before;
    expect(lifetime).toBeGreaterThan(115_000);
    expect(lifetime).toBeLessThanOrEqual(121_000);
  });

  it("needs a signed-in phone to make a code", async () => {
    expect((await request("/api/pairing/offer", { method: "POST" })).status).toBe(401);
  });

  it("signs the headset in to the same account as the phone, with a token that expires", async () => {
    const phone = await signedInPhone();
    const { code } = await offer(phone.token);
    expect(await status(code, phone.token)).toEqual({ status: "waiting" });

    const res = await claim(code);
    expect(res.status).toBe(200);
    const { token, expiresAt } = await res.json<Claimed>();
    expect(await verifySession(token, env.SESSION_SECRET)).toBe(phone.userId);
    const lifetimeHours = (Date.parse(expiresAt) - Date.now()) / 3_600_000;
    expect(lifetimeHours).toBeGreaterThan(11.9);
    expect(lifetimeHours).toBeLessThanOrEqual(12);
    expect(await status(code, phone.token)).toEqual({ status: "claimed" });
  });

  it("lets the headset read the person's profile with its token", async () => {
    const { code } = await offer((await signedInPhone()).token);
    const { token } = await (await claim(code)).json<Claimed>();
    expect((await request("/api/me/profile", { headers: bearer(token) })).status).toBe(200);
  });

  it("accepts a code only once", async () => {
    const { code } = await offer((await signedInPhone()).token);
    expect((await claim(code)).status).toBe(200);
    expect((await claim(code)).status).toBe(404);
  });

  it("refuses a code that expired", async () => {
    const phone = await signedInPhone();
    const { code } = await offer(phone.token);
    await env.DB.prepare("UPDATE pairing_offers SET expires_at = ? WHERE code = ?").bind(new Date(Date.now() - 1000).toISOString(), code).run();
    expect((await claim(code)).status).toBe(404);
    expect(await status(code, phone.token)).toEqual({ status: "expired" });
  });

  it("keeps one code per person: a new code retires the old one", async () => {
    const phone = await signedInPhone();
    const first = await offer(phone.token);
    const second = await offer(phone.token);
    expect(await status(first.code, phone.token)).toEqual({ status: "expired" });
    if (first.code !== second.code) expect((await claim(first.code)).status).toBe(404);
    expect((await claim(second.code)).status).toBe(200);
  });

  it("never hands out a code that another person is still waiting on", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 40; i++) codes.add((await offer((await signedInPhone()).token)).code);
    expect(codes.size).toBe(40);
  });

  it("only tells the owner whether their code was used", async () => {
    const { code } = await offer((await signedInPhone()).token);
    expect(await status(code, (await signedInPhone()).token)).toEqual({ status: "expired" });
    expect((await request(`/api/pairing/offer/${code}`)).status).toBe(401);
  });

  it("rejects a missing or malformed code without counting it as a guess", async () => {
    const ip = "198.51.100.4";
    for (const body of ["{}", JSON.stringify({ code: "12a4" }), "not json"]) {
      const res = await request("/api/pairing/claim", { method: "POST", headers: { "CF-Connecting-IP": ip }, body });
      expect(res.status).toBe(400);
    }
    const { code } = await offer((await signedInPhone()).token);
    expect((await claim(code, ip)).status).toBe(200);
  });

  it("stops a network after five wrong codes in ten minutes, even for a right one", async () => {
    const ip = "203.0.113.9";
    const { code } = await offer((await signedInPhone()).token);
    for (let i = 0; i < 5; i++) expect((await claim(otherCodeThan(code), ip)).status).toBe(404);
    expect((await claim(code, ip)).status).toBe(429);
    expect((await claim(code)).status).toBe(200);
  });

  it("stores only a hash of the guessing network's address", async () => {
    const ip = "192.0.2.77";
    await claim("0000", ip);
    const rows = await env.DB.prepare("SELECT ip_hash FROM session_mints").all<{ ip_hash: string }>();
    expect(rows.results.length).toBeGreaterThan(0);
    for (const row of rows.results) expect(row.ip_hash).not.toContain(ip);
  });
});
