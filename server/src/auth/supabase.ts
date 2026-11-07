import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import type { Env } from "../env";

type KeySet = JWTVerifyGetKey;

const keySets = new Map<string, KeySet>();

// tests swap in a local key set; live, keys come from the project and are cached for the isolate's life
export const deps = {
  keysFor(jwksUrl: string): KeySet {
    let keys = keySets.get(jwksUrl);
    if (!keys) {
      keys = createRemoteJWKSet(new URL(jwksUrl));
      keySets.set(jwksUrl, keys);
    }
    return keys;
  },
};

const issuerOf = (projectUrl: string) => `${projectUrl.replace(/\/+$/, "")}/auth/v1`;

/** The Supabase user id behind an access token, or null when it isn't a valid token for this project. */
export async function verifySupabaseToken(env: Env, token: string): Promise<string | null> {
  if (!env.SUPABASE_URL) return null;
  const issuer = issuerOf(env.SUPABASE_URL);
  try {
    const { payload } = await jwtVerify(token, deps.keysFor(`${issuer}/.well-known/jwks.json`), {
      issuer,
      audience: env.SUPABASE_JWT_AUDIENCE || "authenticated",
      // asymmetric signing keys only: the legacy shared HS256 secret never reaches this server
      algorithms: ["ES256", "RS256"],
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
