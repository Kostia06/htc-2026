import { type Candidate, NOTIFICATION_KINDS, type NotificationKind } from "./types";

export const DAILY_CAP = 3;
export const DAY_MS = 86_400_000;
const QUIET_FROM = 21;
const QUIET_UNTIL = 8;

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// a person who never sent a timezone is treated as UTC; every app sends one on its first fetch
export function localHour(now: Date, timezone: string | null) {
  const zone = timezone && isValidTimezone(timezone) ? timezone : "UTC";
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(now);
  return Number(hour) % 24;
}

/** 21:00 to 08:00 where the person is: nothing buzzes their phone, though the bell still fills. */
export function isQuietHours(now: Date, timezone: string | null) {
  const hour = localHour(now, timezone);
  return hour >= QUIET_FROM || hour < QUIET_UNTIL;
}

type Limits = { said: Set<string>; sentToday: number; disabled: NotificationKind[]; cap?: number };

const rank = (kind: NotificationKind) => NOTIFICATION_KINDS.indexOf(kind);

/**
 * What actually gets said this run: never something already said, never a kind the person turned off, and no more
 * than the daily cap counting what already went out; the most awaited kinds go first. A candidate left out by the
 * cap is not lost: it comes back on the next run while its fact is still fresh.
 */
export function chooseToSay(candidates: Candidate[], limits: Limits): Candidate[] {
  const room = Math.max(0, (limits.cap ?? DAILY_CAP) - limits.sentToday);
  const seen = new Set(limits.said);
  const fresh = candidates.filter((c) => {
    if (seen.has(c.key) || limits.disabled.includes(c.kind)) return false;
    seen.add(c.key);
    return true;
  });
  return fresh.sort((a, b) => rank(a.kind) - rank(b.kind)).slice(0, room);
}

/** Whole days between an ISO date and now, rounded up, or null when the value isn't a date in the future window. */
export function daysUntil(when: string | undefined, now: Date, withinDays: number): number | null {
  if (!when || !/^\d{4}-\d{2}-\d{2}/.test(when)) return null;
  const at = Date.parse(when);
  if (Number.isNaN(at) || at < now.getTime() || at - now.getTime() > withinDays * DAY_MS) return null;
  return Math.max(0, Math.ceil((at - now.getTime()) / DAY_MS));
}

export function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
