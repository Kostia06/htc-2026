import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import type { Env } from "../../src/env";
import { apnsConfig, providerToken, sendPush } from "../../src/notifications/apns";

async function config() {
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  const pem = await exportPKCS8(privateKey);
  // pasted with escaped newlines, the way a dashboard secret often arrives
  const env = { APNS_KEY_ID: "KEY1234567", APNS_TEAM_ID: "5J5P965Q99", APNS_PRIVATE_KEY: pem.replace(/\n/g, "\\n") } as Env;
  return { config: apnsConfig(env)!, publicKey };
}

describe("apnsConfig", () => {
  it("is off unless every secret is set, and defaults to the sandbox and the app's bundle id", async () => {
    expect(apnsConfig({ APNS_KEY_ID: "k", APNS_TEAM_ID: "t" } as Env)).toBeNull();
    expect((await config()).config).toMatchObject({ host: "api.sandbox.push.apple.com", topic: "com.kostiailn.skillit" });
    expect(apnsConfig({ APNS_KEY_ID: "k", APNS_TEAM_ID: "t", APNS_PRIVATE_KEY: "p", APNS_ENV: "production" } as Env)?.host).toBe("api.push.apple.com");
  });
});

describe("providerToken", () => {
  it("signs an ES256 token with the key id and team id Apple expects", async () => {
    const { config: c, publicKey } = await config();
    const token = await providerToken(c);
    const { payload, protectedHeader } = await jwtVerify(token, publicKey);
    expect(protectedHeader).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(payload.iss).toBe("5J5P965Q99");
    expect(typeof payload.iat).toBe("number");
  });
});

describe("sendPush", () => {
  it("posts an alert to /3/device/<token> and reads a 410 as a dead token", async () => {
    const { config: c } = await config();
    const seen: { url: string; headers: Record<string, string>; body: unknown }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      seen.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
      return seen.length === 1 ? new Response(null, { status: 200 }) : Response.json({ reason: "Unregistered" }, { status: 410 });
    }) as unknown as typeof fetch;
    const message = { title: "Hi", body: "There", notificationId: "nt_1", target: { type: "step", id: "s1" }, badge: 2 };

    expect(await sendPush(c, "ab12", message, fetcher)).toBe("sent");
    expect(await sendPush(c, "ab12", message, fetcher)).toBe("dead-token");
    expect(seen[0]?.url).toBe("https://api.sandbox.push.apple.com/3/device/ab12");
    expect(seen[0]?.headers).toMatchObject({ "apns-topic": "com.kostiailn.skillit", "apns-push-type": "alert" });
    expect(seen[0]?.headers.authorization).toMatch(/^bearer ey/);
    expect(seen[0]?.body).toEqual({ aps: { alert: { title: "Hi", body: "There" }, sound: "default", badge: 2, "thread-id": "skillit" }, notificationId: "nt_1", target: { type: "step", id: "s1" } });
  });
});
