import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifySession, issueSession, requireSession } from "../../src/auth/session";
import { deps } from "../../src/auth/supabase";
import type { AppContext, Env } from "../../src/env";
import worker from "../../src/index";

const PROJECT_URL = "https://skillittest.supabase.co";
const ISSUER = `${PROJECT_URL}/auth/v1`;
const USER_ID = "8f9c2b8e-4a1d-4c3e-9b7a-2d5e6f708192";
const supabaseEnv = { ...env, SUPABASE_URL: PROJECT_URL };

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.get("/me", (c) => c.json({ id: c.var.sessionId }));
app.get("/account", (c) => c.json(c.var.account ?? null));

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let requestedJwksUrl = "";
const realKeys = deps.keysFor;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair("ES256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "ES256" };
  deps.keysFor = (url) => {
    requestedJwksUrl = url;
    return createLocalJWKSet({ keys: [jwk] });
  };
});
afterAll(() => {
  deps.keysFor = realKeys;
});

function token(over: { aud?: string; iss?: string; exp?: string; key?: CryptoKey; claims?: Record<string, unknown> } = {}) {
  return new SignJWT({ role: "authenticated", ...over.claims })
    .setProtectedHeader({ alg: "ES256", kid: "k1" })
    .setSubject(USER_ID)
    .setIssuer(over.iss ?? ISSUER)
    .setAudience(over.aud ?? "authenticated")
    .setIssuedAt()
    .setExpirationTime(over.exp ?? "1h")
    .sign(over.key ?? signingKey);
}

const me = (bearer: string, e: Env = supabaseEnv) => app.request("/me", { headers: { Authorization: `Bearer ${bearer}` } }, e);

describe("Supabase sign-in", () => {
  it("accepts a Supabase access token and uses its subject as the user id", async () => {
    const res = await me(await token());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: USER_ID });
    expect(requestedJwksUrl).toBe(`${ISSUER}/.well-known/jwks.json`);
  });

  it.each([
    ["a token for another audience", { aud: "anon" }],
    ["a token from another project", { iss: "https://evil.supabase.co/auth/v1" }],
    ["an expired token", { exp: "-1m" }],
  ])("rejects %s", async (_, over) => {
    expect((await me(await token(over))).status).toBe(401);
  });

  it("rejects a token signed with someone else's key", async () => {
    expect((await me(await token({ key: otherKey }))).status).toBe(401);
  });

  it("honours a custom audience", async () => {
    const customEnv = { ...supabaseEnv, SUPABASE_JWT_AUDIENCE: "raven" };
    expect((await me(await token({ aud: "raven" }), customEnv)).status).toBe(200);
    expect((await me(await token(), customEnv)).status).toBe(401);
  });

  it("carries the account's name, email and phone from the token, for prefilling the resume", async () => {
    const claims = { email: "kostia@example.com", phone: "", user_metadata: { full_name: "  Kostia Ilnytskyi " } };
    const res = await app.request("/account", { headers: { Authorization: `Bearer ${await token({ claims })}` } }, supabaseEnv);
    expect(await res.json()).toEqual({ name: "Kostia Ilnytskyi", email: "kostia@example.com" });
  });

  it("has no account for the server's own tokens", async () => {
    const res = await app.request("/account", { headers: { Authorization: `Bearer ${await issueSession(env.SESSION_SECRET)}` } }, supabaseEnv);
    expect(await res.json()).toBeNull();
  });

  it("still accepts the server's own tokens, which paired headsets use", async () => {
    expect((await me(await issueSession(env.SESSION_SECRET))).status).toBe(200);
  });

  it("tolerates a project URL saved with Windows line endings or spaces", async () => {
    const windowsEnv = { ...supabaseEnv, SUPABASE_URL: ` ${PROJECT_URL}\r` };
    expect((await me(await token(), windowsEnv)).status).toBe(200);
  });

  it("ignores Supabase tokens when Supabase is not configured", async () => {
    expect((await me(await token(), env)).status).toBe(401);
  });

  it("signs a headset into the account of a Supabase-signed-in phone", async () => {
    const request = (path: string, init: RequestInit = {}) => worker.request(path, init, supabaseEnv);
    const offered = await request("/api/pairing/offer", { method: "POST", headers: { Authorization: `Bearer ${await token()}` } });
    expect(offered.status).toBe(201);
    const { code } = await offered.json<{ code: string }>();

    const claimed = await request("/api/pairing/claim", { method: "POST", headers: { "CF-Connecting-IP": crypto.randomUUID() }, body: JSON.stringify({ code }) });
    const result = await claimed.json<{ token: string }>();
    expect(await verifySession(result.token, env.SESSION_SECRET)).toBe(USER_ID);
    expect((await me(result.token)).status).toBe(200);
  });
});
