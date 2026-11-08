import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { verifySession } from "../../src/auth/session";
import {
  deleteStaleHeadsets,
  headsetNameFrom,
  isHeadsetConnected,
  listHeadsets,
  refreshHeadset,
  registerHeadset,
  revokeHeadset,
  touchHeadset,
} from "../../src/headset/devices";

const NOW = new Date("2026-11-07T10:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const SECRET = env.SESSION_SECRET;

describe("remembered headsets", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM headset_devices").run();
  });

  it("names a headset from its browser", () => {
    expect(headsetNameFrom("Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 OculusBrowser/35.0")).toBe("Quest 3");
    expect(headsetNameFrom("Mozilla/5.0 (X11; Linux x86_64; Quest Pro) OculusBrowser/35.0")).toBe("Quest Pro");
    expect(headsetNameFrom("Mozilla/5.0 (Linux; Android 10; Pico 4) PicoBrowser")).toBe("Pico 4");
    expect(headsetNameFrom("Mozilla/5.0 (Macintosh) Safari")).toBe("Headset");
    expect(headsetNameFrom(undefined)).toBe("Headset");
  });

  it("registers a headset with a short access token and a long refresh credential", async () => {
    const creds = await registerHeadset(env, "alice", "Quest 3", SECRET, NOW);
    expect(await verifySession(creds.token, SECRET, later(59 * 60_000))).toBe("alice");
    expect(await verifySession(creds.token, SECRET, later(61 * 60_000))).toBeNull();
    expect(creds.refreshToken.startsWith(`${creds.deviceId}.`)).toBe(true);
    expect(new Date(creds.refreshExpiresAt).getTime() - NOW.getTime()).toBe(60 * 86_400_000);

    const row = await env.DB.prepare("SELECT refresh_hash FROM headset_devices WHERE id = ?").bind(creds.deviceId).first<{ refresh_hash: string }>();
    expect(row?.refresh_hash).not.toContain(creds.refreshToken.split(".")[1]);
    expect(await listHeadsets(env, "alice", NOW)).toEqual([
      { id: creds.deviceId, name: "Quest 3", createdAt: NOW.toISOString(), lastSeenAt: NOW.toISOString(), connected: true },
    ]);
  });

  it("refreshes into a new access token and rotates the refresh credential", async () => {
    const first = await registerHeadset(env, "alice", "Quest 3", SECRET, NOW);
    const second = await refreshHeadset(env, first.refreshToken, SECRET, later(86_400_000));
    expect(second).not.toBeNull();
    expect(second?.deviceId).toBe(first.deviceId);
    expect(second?.refreshToken).not.toBe(first.refreshToken);
    expect(await verifySession(second!.token, SECRET, later(86_400_000 + 60_000))).toBe("alice");
    // the old credential is spent
    expect(await refreshHeadset(env, first.refreshToken, SECRET, later(86_400_000))).toBeNull();
    // and the new one works
    expect(await refreshHeadset(env, second!.refreshToken, SECRET, later(2 * 86_400_000))).not.toBeNull();
  });

  it("refuses an unknown, tampered, expired or revoked credential", async () => {
    const creds = await registerHeadset(env, "alice", "Quest 3", SECRET, NOW);
    expect(await refreshHeadset(env, "nope", SECRET, NOW)).toBeNull();
    expect(await refreshHeadset(env, `${creds.deviceId}.wrong`, SECRET, NOW)).toBeNull();
    expect(await refreshHeadset(env, creds.refreshToken, SECRET, later(61 * 86_400_000))).toBeNull();

    const other = await registerHeadset(env, "alice", "Quest 2", SECRET, NOW);
    expect(await revokeHeadset(env, "alice", other.deviceId, NOW)).toBe(true);
    expect(await refreshHeadset(env, other.refreshToken, SECRET, NOW)).toBeNull();
    expect((await listHeadsets(env, "alice", NOW)).map((d) => d.name)).toEqual(["Quest 3"]);
  });

  it("only lets the owner revoke, and only once", async () => {
    const creds = await registerHeadset(env, "alice", "Quest 3", SECRET, NOW);
    expect(await revokeHeadset(env, "bob", creds.deviceId, NOW)).toBe(false);
    expect(await revokeHeadset(env, "alice", creds.deviceId, NOW)).toBe(true);
    expect(await revokeHeadset(env, "alice", creds.deviceId, NOW)).toBe(false);
  });

  it("counts a headset as connected only when it polled in the last 30 seconds", async () => {
    const creds = await registerHeadset(env, "alice", "Quest 3", SECRET, NOW);
    expect(await isHeadsetConnected(env, "alice", later(29_000))).toBe(true);
    expect(await isHeadsetConnected(env, "alice", later(31_000))).toBe(false);
    expect(await touchHeadset(env, "alice", creds.deviceId, later(60_000))).toBe("ok");
    expect(await isHeadsetConnected(env, "alice", later(80_000))).toBe(true);
    expect(await isHeadsetConnected(env, "bob", later(80_000))).toBe(false);
  });

  it("tells a poll from a revoked or foreign headset to sign in again", async () => {
    const creds = await registerHeadset(env, "alice", "Quest 3", SECRET, NOW);
    expect(await touchHeadset(env, "bob", creds.deviceId, NOW)).toBe("unknown");
    await revokeHeadset(env, "alice", creds.deviceId, NOW);
    expect(await touchHeadset(env, "alice", creds.deviceId, NOW)).toBe("unknown");
  });

  it("drops revoked and expired headsets when collecting garbage", async () => {
    const revoked = await registerHeadset(env, "alice", "Quest 3", SECRET, NOW);
    await revokeHeadset(env, "alice", revoked.deviceId, NOW);
    await registerHeadset(env, "alice", "Quest 2", SECRET, NOW);
    expect(await deleteStaleHeadsets(env, later(60_000))).toBe(1);
    expect(await deleteStaleHeadsets(env, later(61 * 86_400_000))).toBe(1);
  });
});
