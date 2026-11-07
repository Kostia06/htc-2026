import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deps } from "../../src/auth/auth0";
import { issueSession, requireSession } from "../../src/auth/session";
import type { AppContext, Env } from "../../src/env";

const DOMAIN = "raven-test.us.auth0.com";
const AUDIENCE = "https://api.raven.test";
const auth0Env = { ...env, AUTH0_DOMAIN: DOMAIN, AUTH0_AUDIENCE: AUDIENCE };

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.get("/me", (c) => c.json({ id: c.var.sessionId }));

let signingKey: CryptoKey;
let otherKey: CryptoKey;
const realKeys = deps.keysFor;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  deps.keysFor = () => createLocalJWKSet({ keys: [jwk] });
});
afterAll(() => {
  deps.keysFor = realKeys;
});

function token(over: { aud?: string; iss?: string; exp?: string; key?: CryptoKey } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setSubject("google-oauth2|12345")
    .setIssuer(over.iss ?? `https://${DOMAIN}/`)
    .setAudience(over.aud ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(over.exp ?? "1h")
    .sign(over.key ?? signingKey);
}

const me = (bearer: string, e: Env = auth0Env) => app.request("/me", { headers: { Authorization: `Bearer ${bearer}` } }, e);

describe("Auth0 sign-in", () => {
  it("accepts an Auth0 token and uses its subject as the user id", async () => {
    const res = await me(await token());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "google-oauth2|12345" });
  });

  it.each([
    ["another API's token", { aud: "https://someone-else" }],
    ["a token from another tenant", { iss: "https://evil.auth0.com/" }],
    ["an expired token", { exp: "-1m" }],
  ])("rejects %s", async (_, over) => {
    expect((await me(await token(over))).status).toBe(401);
  });

  it("rejects a token signed with someone else's key", async () => {
    expect((await me(await token({ key: otherKey }))).status).toBe(401);
  });

  it("still accepts the server's own tokens, which paired headsets use", async () => {
    expect((await me(await issueSession(env.SESSION_SECRET))).status).toBe(200);
  });

  it("ignores Auth0 tokens when Auth0 is not configured", async () => {
    expect((await me(await token(), env)).status).toBe(401);
  });
});
