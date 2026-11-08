import type { JWTPayload } from "jose";

/** What the sign-in account says about the person: only fields it actually has, never stored by this server. */
export type Account = { name?: string; email?: string; phone?: string };

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : undefined);

// Supabase puts the address and phone at the top of its access token, and the name the person signed up with (or the
// provider sent) in user_metadata as full_name or name
export function accountFromClaims(payload: JWTPayload): Account {
  const meta = typeof payload.user_metadata === "object" && payload.user_metadata !== null ? (payload.user_metadata as Record<string, unknown>) : {};
  const account: Account = { name: text(meta.full_name) ?? text(meta.name), email: text(payload.email), phone: text(payload.phone) };
  return Object.fromEntries(Object.entries(account).filter(([, value]) => value !== undefined));
}
