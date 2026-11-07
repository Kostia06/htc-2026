import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import { issueSession, verifySession } from "../src/session";

describe("sessions", () => {
  it("verifies a token it issued back to the same id", async () => {
    const token = await issueSession("s3cret");
    const id = await verifySession(token, "s3cret");
    expect(id).toBe(token.split(".")[0]);
  });

  it("rejects a token with a changed character", async () => {
    const token = await issueSession("s3cret");
    const last = token.at(-1) === "a" ? "b" : "a";
    expect(await verifySession(token.slice(0, -1) + last, "s3cret")).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await issueSession("other");
    expect(await verifySession(token, "s3cret")).toBeNull();
  });

  it("returns 401 on a protected route without a token", async () => {
    const res = await app.request("/api/memory/acme?q=x", {}, env);
    expect(res.status).toBe(401);
  });

  it("issues a usable token from POST /api/session", async () => {
    const res = await app.request("/api/session", { method: "POST" }, env);
    expect(res.status).toBe(200);
    const { token } = await res.json<{ token: string }>();
    expect(await verifySession(token, env.SESSION_SECRET)).not.toBeNull();
  });

  it("limits new sessions to 10 per hour per IP", async () => {
    const mint = () => app.request("/api/session", { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.9" } }, env);
    for (let i = 0; i < 10; i++) expect((await mint()).status).toBe(200);
    expect((await mint()).status).toBe(429);
  });
});
