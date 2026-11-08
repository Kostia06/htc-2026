import type { Env } from "../env";
import { issueExpiringSessionFor } from "./session";

const OFFER_LIFETIME_MS = 2 * 60 * 1000;
const HEADSET_SESSION_MS = 12 * 60 * 60 * 1000;
const CODE_SPACE = 10_000;
// with a few hundred live codes at most, ten random draws in a row all colliding means something is wrong
const MAX_DRAWS = 10;

export type Offer = { code: string; expiresAt: string };
export type OfferStatus = "waiting" | "claimed" | "expired";
export type HeadsetSession = { token: string; expiresAt: string };

export const isPairingCode = (code: unknown): code is string => typeof code === "string" && /^\d{4}$/.test(code);

function randomCode() {
  // rejection sampling keeps every code equally likely
  const limit = 65_536 - (65_536 % CODE_SPACE);
  for (;;) {
    const [value] = crypto.getRandomValues(new Uint16Array(1));
    if (value < limit) return String(value % CODE_SPACE).padStart(4, "0");
  }
}

// a new code replaces the person's previous one, so an old code shown on a forgotten screen stops working
export async function offerCode(env: Env, userId: string, now = new Date()): Promise<Offer> {
  const expiresAt = new Date(now.getTime() + OFFER_LIFETIME_MS).toISOString();
  await deleteExpiredPairings(env, now);
  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    const code = randomCode();
    const [, inserted] = await env.DB.batch([
      env.DB.prepare("DELETE FROM pairing_offers WHERE user_id = ?").bind(userId),
      env.DB.prepare("INSERT INTO pairing_offers (user_id, code, status, created_at, expires_at) VALUES (?, ?, 'waiting', ?, ?) ON CONFLICT DO NOTHING").bind(
        userId,
        code,
        now.toISOString(),
        expiresAt,
      ),
    ]);
    if (inserted.meta.changes === 1) return { code, expiresAt };
  }
  throw new Error("no free pairing code");
}

// conditional update: two headsets typing the same code can't both win
export async function claimCode(env: Env, code: string, secret: string, now = new Date()): Promise<HeadsetSession | null> {
  const row = await env.DB.prepare("UPDATE pairing_offers SET status = 'claimed' WHERE code = ? AND status = 'waiting' AND expires_at > ? RETURNING user_id")
    .bind(code, now.toISOString())
    .first<{ user_id: string }>();
  if (!row) return null;
  const expiresAt = new Date(now.getTime() + HEADSET_SESSION_MS);
  return { token: await issueExpiringSessionFor(secret, row.user_id, expiresAt), expiresAt: expiresAt.toISOString() };
}

// someone else's code reads as expired, so the endpoint can't be used to find live codes
export async function offerStatus(env: Env, userId: string, code: string, now = new Date()): Promise<OfferStatus> {
  const row = await env.DB.prepare("SELECT status, expires_at FROM pairing_offers WHERE user_id = ? AND code = ?")
    .bind(userId, code)
    .first<{ status: "waiting" | "claimed"; expires_at: string }>();
  if (!row) return "expired";
  if (row.status === "claimed") return "claimed";
  return row.expires_at > now.toISOString() ? "waiting" : "expired";
}

export async function deleteExpiredPairings(env: Env, now = new Date()) {
  const result = await env.DB.prepare("DELETE FROM pairing_offers WHERE expires_at <= ?").bind(now.toISOString()).run();
  return result.meta.changes;
}
