import { importPKCS8, SignJWT } from "jose";
import type { Env } from "../env";

export type ApnsConfig = { keyId: string; teamId: string; privateKey: string; topic: string; host: string };

export type PushMessage = { title: string; body: string; notificationId: string; target: unknown; badge: number };

export type PushOutcome = "sent" | "dead-token" | "failed";

/** Push is on only when every APNs secret is set; otherwise the apps' background fetch is the only delivery. */
export function apnsConfig(env: Env): ApnsConfig | null {
  const { APNS_KEY_ID: keyId, APNS_TEAM_ID: teamId, APNS_PRIVATE_KEY: privateKey } = env;
  if (!keyId || !teamId || !privateKey) return null;
  const host = env.APNS_ENV === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  return { keyId, teamId, privateKey, topic: env.APNS_TOPIC || "com.kostiailn.skillit", host };
}

// Apple rejects a token older than an hour and one minted more than every 20 minutes; 40 sits safely between
const TOKEN_TTL_MS = 40 * 60 * 1000;
let cached: { keyId: string; token: string; mintedAt: number } | null = null;

// secrets pasted into a dashboard often arrive with literal "\n" or with the PEM header lines stripped
function toPem(raw: string) {
  const text = raw.replace(/\\n/g, "\n").trim();
  if (text.includes("BEGIN PRIVATE KEY")) return text;
  return `-----BEGIN PRIVATE KEY-----\n${text.replace(/\s+/g, "")}\n-----END PRIVATE KEY-----`;
}

export async function providerToken(config: ApnsConfig, now = Date.now()): Promise<string> {
  if (cached && cached.keyId === config.keyId && now - cached.mintedAt < TOKEN_TTL_MS) return cached.token;
  const key = await importPKCS8(toPem(config.privateKey), "ES256");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(Math.floor(now / 1000))
    .sign(key);
  cached = { keyId: config.keyId, token, mintedAt: now };
  return token;
}

export function apnsPayload(message: PushMessage) {
  return {
    aps: { alert: { title: message.title, body: message.body }, sound: "default", badge: message.badge, "thread-id": "skillit" },
    // the app reads these on tap to open the right screen and to skip posting the same one again locally
    notificationId: message.notificationId,
    target: message.target,
  };
}

/**
 * One alert to one device. APNs needs HTTP/2: deployed Workers reach it because Cloudflare's edge speaks HTTP/2 to
 * the origin, while `wrangler dev` (workerd, HTTP/1.1 only) cannot, so pushes only work once deployed.
 */
export async function sendPush(config: ApnsConfig, deviceToken: string, message: PushMessage, fetcher: typeof fetch = fetch): Promise<PushOutcome> {
  const res = await fetcher(`https://${config.host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await providerToken(config)}`,
      "apns-topic": config.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-collapse-id": message.notificationId.slice(0, 64),
      "content-type": "application/json",
    },
    body: JSON.stringify(apnsPayload(message)),
  }).catch(() => null);
  if (!res) return "failed";
  if (res.ok) return "sent";
  const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason;
  // 410: the app was removed; BadDeviceToken: a sandbox token sent to production or the reverse
  if (res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered") return "dead-token";
  console.warn(`apns push failed: ${res.status} ${reason ?? ""}`);
  return "failed";
}
