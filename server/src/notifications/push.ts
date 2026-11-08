import type { Env } from "../env";
import { apnsConfig, type PushOutcome, sendPush } from "./apns";
import { DAY_MS, isQuietHours } from "./rules";
import { devicesFor, forgetTokens, loadSettings } from "./settings";
import { awaitingPush, markPushed, unreadCount } from "./store";

export type Pusher = (deviceToken: string, message: Parameters<typeof sendPush>[2]) => Promise<PushOutcome>;

const livePusher = (env: Env): Pusher | null => {
  const config = apnsConfig(env);
  return config ? (token, message) => sendPush(config, token, message) : null;
};

/**
 * Sends what's waiting to every device the person registered, unless it is night where they are; whatever waits
 * through the night goes out on the next run after 08:00, provided it is still under a day old and unread.
 */
export async function pushPending(env: Env, userId: string, now: Date, pusher: Pusher | null = livePusher(env)) {
  if (!pusher) return { pushed: 0, skipped: "push not configured" as const };
  const settings = await loadSettings(env, userId);
  if (isQuietHours(now, settings.timezone)) return { pushed: 0, skipped: "quiet hours" as const };
  const [pending, tokens] = await Promise.all([awaitingPush(env, userId, new Date(now.getTime() - DAY_MS)), devicesFor(env, userId)]);
  if (pending.length === 0 || tokens.length === 0) return { pushed: 0 };

  const badge = await unreadCount(env, userId);
  const dead = new Set<string>();
  for (const item of pending) {
    const outcomes = await Promise.all(
      tokens.filter((t) => !dead.has(t)).map(async (token) => [token, await pusher(token, { title: item.title, body: item.body, notificationId: item.id, target: item.target, badge })] as const),
    );
    for (const [token, outcome] of outcomes) if (outcome === "dead-token") dead.add(token);
  }
  await forgetTokens(env, [...dead]);
  // marked even when a push failed: one retry storm a night is worse than one missed buzz the bell still shows
  await markPushed(env, userId, pending.map((p) => p.id), now);
  return { pushed: pending.length };
}
