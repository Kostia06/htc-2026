import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import type { Env } from "../env";

type KeySet = JWTVerifyGetKey;

const keySets = new Map<string, KeySet>();

// tests swap in a local key set; live, keys come from the tenant and are cached for the isolate's life
export const deps = {
  keysFor(domain: string): KeySet {
    let keys = keySets.get(domain);
    if (!keys) {
      keys = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
      keySets.set(domain, keys);
    }
    return keys;
  },
};

const isConfigured = (env: Env): env is Env & { AUTH0_DOMAIN: string; AUTH0_AUDIENCE: string } =>
  Boolean(env.AUTH0_DOMAIN && env.AUTH0_AUDIENCE);

/** The Auth0 user id behind a token, or null when it isn't a valid token for this API. */
export async function verifyAuth0Token(env: Env, token: string): Promise<string | null> {
  if (!isConfigured(env)) return null;
  try {
    const { payload } = await jwtVerify(token, deps.keysFor(env.AUTH0_DOMAIN), {
      issuer: `https://${env.AUTH0_DOMAIN}/`,
      audience: env.AUTH0_AUDIENCE,
      algorithms: ["RS256"],
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
