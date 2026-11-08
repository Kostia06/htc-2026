import type { HeadsetSession } from "../pairing/api";
import { clearToken, readToken } from "../session/tokenStorage";

const KEY = "raven.headset";

// storage can throw in private browsing or when site data is blocked; nothing stored just means "signed out"
export function readSession(): HeadsetSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isSession(parsed)) return parsed;
    }
    // a headset signed in before sessions were remembered holds only a token; it's good until it expires
    const legacy = readToken();
    return legacy ? { token: legacy, expiresAt: expiryInside(legacy) } : null;
  } catch {
    return null;
  }
}

export function saveSession(session: HeadsetSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
    clearToken();
  } catch {
    // the session still works until the tab closes
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
    clearToken();
  } catch {
    // nothing stored, nothing to clear
  }
}

function isSession(value: unknown): value is HeadsetSession {
  if (!value || typeof value !== "object") return false;
  const { token, expiresAt } = value as Record<string, unknown>;
  return typeof token === "string" && typeof expiresAt === "string";
}

// the old headset token carries its expiry (in seconds) as its middle part: `id.expiresAt.sig`
function expiryInside(token: string) {
  const [, seconds] = token.split(".");
  return seconds && /^\d+$/.test(seconds) ? new Date(Number(seconds) * 1000).toISOString() : new Date(0).toISOString();
}
