import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { profile } from "../../src/api/profile";
import { issueSession, requireSession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.route("/", profile);

const call = (token: string, method: string, body?: unknown) =>
  app.request("/", { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }, env);

describe("/api/me/profile", () => {
  it("patches and reads the caller's own profile", async () => {
    const token = await issueSession(env.SESSION_SECRET);
    expect((await call(token, "PATCH", { targetRoles: ["Junior developer"] })).status).toBe(200);
    expect(await (await call(token, "GET")).json()).toMatchObject({ profile: { targetRoles: ["Junior developer"] } });
  });

  it("rejects a body that is not a profile patch", async () => {
    const token = await issueSession(env.SESSION_SECRET);
    expect((await call(token, "PATCH", ["nope"])).status).toBe(400);
  });

  it("keeps two people's profiles apart and deletes on request", async () => {
    const a = await issueSession(env.SESSION_SECRET);
    const b = await issueSession(env.SESSION_SECRET);
    await call(a, "PATCH", { goals: ["Become a nurse"] });
    expect(await (await call(b, "GET")).json()).toMatchObject({ profile: { goals: [] } });
    expect((await call(a, "DELETE")).status).toBe(204);
    expect(await (await call(a, "GET")).json()).toMatchObject({ profile: { goals: [] } });
  });
});
