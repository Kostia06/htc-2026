import type { MiddlewareHandler } from "hono";
import type { AppContext } from "./env";

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
  const id = crypto.randomUUID();
  return `${id}.${await sign(id, secret)}`;
}

export async function verifySession(token: string, secret: string) {
  const [id, sig] = token.split(".");
  if (!id || !sig) return null;
  const expected = await sign(id, secret);
  // constant-time compare so the signature can't be guessed byte by byte
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? id : null;
}

export const requireSession: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "") ?? "";
  const id = await verifySession(token, c.env.SESSION_SECRET);
  if (!id) return c.json({ error: "unauthorized" }, 401);
  c.set("sessionId", id);
  await next();
};
