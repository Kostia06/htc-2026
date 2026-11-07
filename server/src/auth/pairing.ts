import type { Env } from "../env";
import { sha256 } from "../lib/hash";
import { issueSessionFor } from "./session";

const LIFETIME_MS = 5 * 60 * 1000;
// no 0/O, 1/I/L: the code may be typed by hand when a camera can't read the QR
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

export type NewPairing = { code: string; pollToken: string; expiresAt: string; link: string };
export type ApproveResult = "approved" | "not_found" | "expired" | "already_used";
export type PollResult = { status: "pending" } | { status: "approved"; token: string } | { status: "expired" } | null;

type PairingRow = { poll_hash: string; user_id: string | null; status: "pending" | "approved" | "claimed"; expires_at: string };

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function randomSecret() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/[+/=]/g, "");
}

export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^0-9A-Z]/g, "");

async function findPairing(env: Env, code: string) {
  return env.DB.prepare("SELECT poll_hash, user_id, status, expires_at FROM device_pairings WHERE code = ?").bind(normalizeCode(code)).first<PairingRow>();
}

const isExpired = (row: PairingRow, now: Date) => row.expires_at <= now.toISOString();

export async function createPairing(env: Env, now = new Date()): Promise<NewPairing> {
  const code = randomCode();
  const pollToken = randomSecret();
  const expiresAt = new Date(now.getTime() + LIFETIME_MS).toISOString();
  await env.DB.prepare("INSERT INTO device_pairings (code, poll_hash, status, created_at, expires_at) VALUES (?, ?, 'pending', ?, ?)")
    .bind(code, await sha256(pollToken), now.toISOString(), expiresAt)
    .run();
  return { code, pollToken, expiresAt, link: `raven://pair?code=${code}` };
}

export async function approvePairing(env: Env, code: string, userId: string, now = new Date()): Promise<ApproveResult> {
  const row = await findPairing(env, code);
  if (!row) return "not_found";
  if (isExpired(row, now)) return "expired";
  // conditional update: two phones scanning the same code can't both win
  const result = await env.DB.prepare("UPDATE device_pairings SET user_id = ?, status = 'approved' WHERE code = ? AND status = 'pending'")
    .bind(userId, normalizeCode(code))
    .run();
  return result.meta.changes === 1 ? "approved" : "already_used";
}

export async function pollPairing(env: Env, code: string, pollToken: string, now = new Date()): Promise<PollResult> {
  const row = await findPairing(env, code);
  if (!row || row.poll_hash !== (await sha256(pollToken))) return null;
  if (row.status === "claimed" || isExpired(row, now)) return { status: "expired" };
  if (row.status === "pending" || !row.user_id) return { status: "pending" };

  const claimed = await env.DB.prepare("UPDATE device_pairings SET status = 'claimed' WHERE code = ? AND status = 'approved'").bind(normalizeCode(code)).run();
  if (claimed.meta.changes !== 1) return { status: "expired" };
  return { status: "approved", token: await issueSessionFor(env.SESSION_SECRET, row.user_id) };
}

export async function deleteExpiredPairings(env: Env, now = new Date()) {
  const result = await env.DB.prepare("DELETE FROM device_pairings WHERE expires_at <= ?").bind(now.toISOString()).run();
  return result.meta.changes;
}
