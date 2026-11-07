import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { memoryFor } from "../src/agents/core/memory-port";
import { issueSession } from "../src/auth/session";
import app from "../src/index";

describe("wiring", () => {
  it("binds the agent's memory port to one user's encrypted store", async () => {
    await memoryFor(env, "alice").remember({ kind: "goal", text: "Become a data analyst at ATB" });
    expect((await memoryFor(env, "alice").recall({ query: "data analyst" })).map((m) => m.text)).toContain("Become a data analyst at ATB");
    expect(await memoryFor(env, "bob").recall({ query: "data analyst" })).toEqual([]);
  });

  it("mounts the private memory routes behind a session", async () => {
    const token = await issueSession(env.SESSION_SECRET);
    const res = await app.request("/api/me/memories", { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ memories: [] });
    expect((await app.request("/api/me/memories", {}, env)).status).toBe(401);
  });

  it("mounts the agent routes", async () => {
    const token = await issueSession(env.SESSION_SECRET);
    const res = await app.request(
      "/api/agent/not-a-skill",
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ platform: "app", input: {} }) },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty("error");
  });
});
