const GROUP_SIZE = 4;
const DEFAULT_LIFETIME_MS = 5 * 60 * 1000;
const LONGEST_PLAUSIBLE_LIFETIME_MS = 10 * 60 * 1000;

export function formatCode(code: string) {
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return clean.match(new RegExp(`.{1,${GROUP_SIZE}}`, "g"))?.join(" ") ?? "";
}

// a headset clock that is off by minutes would make expiresAt useless, so anchor the deadline to when the code arrived
export function deadlineFor(expiresAt: string, receivedAt: number) {
  const lifetime = Date.parse(expiresAt) - receivedAt;
  const isPlausible = lifetime > 0 && lifetime <= LONGEST_PLAUSIBLE_LIFETIME_MS;
  return receivedAt + (isPlausible ? lifetime : DEFAULT_LIFETIME_MS);
}

export const secondsUntil = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / 1000));

export function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}
