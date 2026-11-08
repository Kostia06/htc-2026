import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../env";
import { verifySupabaseAccount } from "./supabase";

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sign(id: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(id)));
}

export async function issueSession(secret: string) {
  return issueSessionFor(secret, crypto.randomUUID());
}

// a second device on the same account gets its own token for the same id
export async function issueSessionFor(secret: string, userId: string) {
  return `${userId}.${await sign(userId, secret)}`;
}

// a headset signs in from a shared device, so its token carries an expiry inside the signed part: `id.expiresAtSeconds.sig`
export async function issueExpiringSessionFor(secret: string, userId: string, expiresAt: Date) {
  const payload = `${userId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return `${payload}.${await sign(payload, secret)}`;
}

// constant-time compare so the signature can't be guessed byte by byte
function isSameSignature(expected: string, sig: string) {
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export async function verifySession(token: string, secret: string, now = new Date()) {
  const parts = token.split(".");
  if (parts.length === 2) {
    const [id, sig] = parts;
    return id && sig && isSameSignature(await sign(id, secret), sig) ? id : null;
  }
  if (parts.length !== 3) return null;
  const [id, expiresAtSeconds, sig] = parts;
  if (!id || !/^\d+$/.test(expiresAtSeconds) || !sig) return null;
  if (!isSameSignature(await sign(`${id}.${expiresAtSeconds}`, secret), sig)) return null;
  return Number(expiresAtSeconds) * 1000 > now.getTime() ? id : null;
}

export const requireSession: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "") ?? "";
  // people sign in with Supabase; paired headsets carry the server's own token for the same account
  const supabase = await verifySupabaseAccount(c.env, token);
  const id = supabase?.id ?? (await verifySession(token, c.env.SESSION_SECRET));
  if (!id) return c.json({ error: "unauthorized" }, 401);
  c.set("sessionId", id);
  // only a person's own sign-in carries an account; a headset token never does
  if (supabase) c.set("account", supabase.account);
  await next();
};
