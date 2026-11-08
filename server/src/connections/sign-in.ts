import type { Env } from "../env";
import { allowedOrigins } from "../lib/cors";

const APP_SCHEME = "skillit://";

// Composio's terminal states for a sign-in that will never finish
export const ENDED = new Set(["FAILED", "EXPIRED", "INACTIVE", "REVOKED", "DELETED"]);

// only back into our own app or one of our own web origins, so the link can't be used to bounce someone elsewhere
export function safeReturnUrl(env: Env, returnTo: unknown): string | undefined {
  if (typeof returnTo !== "string" || returnTo.length > 300) return undefined;
  if (returnTo.startsWith(APP_SCHEME)) return returnTo;
  try {
    return allowedOrigins(env.ALLOWED_ORIGINS).includes(new URL(returnTo).origin) ? returnTo : undefined;
  } catch {
    return undefined;
  }
}
