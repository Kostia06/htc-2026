import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import type { Env } from "../env";
import { type Account, accountFromClaims } from "./account";

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
  return (await verifySupabaseAccount(env, token))?.id ?? null;
}

/** The user id and what the account says about the person (name, email, phone), or null for an invalid token. */
export async function verifySupabaseAccount(env: Env, token: string): Promise<{ id: string; account: Account } | null> {
  // trimmed: a .dev.vars saved on Windows ends every value in "\r", and then no issuer ever matches
  const projectUrl = env.SUPABASE_URL?.trim();
  if (!projectUrl) return null;
  const issuer = issuerOf(projectUrl);
  try {
    const { payload } = await jwtVerify(token, deps.keysFor(`${issuer}/.well-known/jwks.json`), {
      issuer,
      audience: env.SUPABASE_JWT_AUDIENCE?.trim() || "authenticated",
      // asymmetric signing keys only: the legacy shared HS256 secret never reaches this server
      algorithms: ["ES256", "RS256"],
    });
    return payload.sub ? { id: payload.sub, account: accountFromClaims(payload) } : null;
  } catch (e) {
    // the reason only, never the token: a silent 401 is impossible to debug from a local setup
    const reason = (e as { code?: string }).code ?? (e as Error).name;
    console.warn(`supabase token rejected: ${reason}`);
    return null;
  }
}
