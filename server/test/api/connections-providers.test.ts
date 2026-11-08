import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConnection } from "../../src/connections/store";
import { listMemories } from "../../src/memory/private/store";
import { getProfile, updateProfile } from "../../src/memory/profile/store";
import { fakeDeps } from "../agents/fakes";
import { fakeComposio, keyed } from "../connections/fixtures";
import { testApp } from "./connections-app";

afterEach(() => vi.restoreAllMocks());

const user = () => `mp-${crypto.randomUUID()}`;
type View = { id: string; name: string; category: string; configured: boolean; status: string; projects: { name: string }[]; suggestions: string[] };

async function connect(app: ReturnType<typeof testApp>, me: string, provider: string) {
  expect((await app.request(me, "POST", `/${provider}`, { returnTo: "skillit://connections/" + provider })).status).toBe(200);
  await app.request(me, "GET");
  await app.settle();
}

describe("/api/connections with several providers", () => {
  it("lists every provider, configured only where Composio has an enabled auth config", async () => {
    fakeComposio();
    const { request } = testApp(fakeDeps({ env: keyed }).deps);
    const body = (await (await request(user(), "GET")).json()) as { connections: View[] };
    const byId = Object.fromEntries(body.connections.map((v) => [v.id, v]));
    expect(Object.keys(byId)).toEqual(["github", "gitlab", "bitbucket", "dribbble", "notion", "googledrive", "youtube"]);
    expect(Object.fromEntries(body.connections.map((v) => [v.id, v.configured]))).toEqual({
      github: true,
      gitlab: true,
      bitbucket: false,
      dribbble: false,
      notion: true,
      googledrive: false,
      youtube: false,
    });
    for (const view of body.connections) {
      expect(view).toMatchObject({ status: "not_connected", projects: [], suggestions: [] });
      expect(view.name).toBeTruthy();
      expect(["code", "design", "writing", "documents", "video"]).toContain(view.category);
    }
  });

  it("says not configured, without calling Composio, for a provider with no auth config, and 404s an unknown one", async () => {
    const { calls } = fakeComposio();
    const { request } = testApp(fakeDeps({ env: keyed }).deps);
    const me = user();
    const res = await request(me, "POST", "/dribbble", {});
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ configured: false });
    expect(calls.filter((c) => c.url.includes("/connected_accounts"))).toEqual([]);
    expect((await request(me, "POST", "/myspace", {})).status).toBe(404);
    expect((await request(me, "DELETE", "/myspace")).status).toBe(404);
    expect((await request(me, "POST", "/myspace/import")).status).toBe(404);
  });

  it("reports every provider as not configured without a Composio key", async () => {
    const { calls } = fakeComposio();
    const { request } = testApp(fakeDeps().deps, env);
    const body = (await (await request(user(), "GET")).json()) as { connections: View[] };
    expect(body.connections.every((v) => !v.configured)).toBe(true);
    expect(calls).toEqual([]);
  });

  it("disconnecting one provider deletes only what that provider imported", async () => {
    const { calls } = fakeComposio();
    const me = user();
    await updateProfile(env, me, { projects: [{ name: "My own project", summary: "Typed in by me" }] });
    const app = testApp(fakeDeps({ env: keyed }).deps);
    await connect(app, me, "gitlab");
    await connect(app, me, "notion");

    const before = (await getProfile(env, me)).projects.map((p) => p.name);
    expect(before).toEqual(["My own project", "thesis-pipeline", "notes", "Case study: redesigning the campus food app"]);
    const notesBefore = (await listMemories(env, me)).map((m) => m.text);
    expect(notesBefore.some((t) => t.startsWith("GitLab idea:"))).toBe(true);
    expect(notesBefore.some((t) => t.startsWith("Notion idea:"))).toBe(true);

    const res = await app.request(me, "DELETE", "/notion");
    expect(res.status).toBe(200);
    expect(calls.filter((c) => c.method === "DELETE").map((c) => c.url)).toEqual(["https://backend.composio.dev/api/v3.1/connected_accounts/ca_notion?revoke_on_delete=true"]);
    expect((await getProfile(env, me)).projects.map((p) => p.name)).toEqual(["My own project", "thesis-pipeline", "notes"]);
    const notesAfter = (await listMemories(env, me)).map((m) => m.text);
    expect(notesAfter.every((t) => !t.startsWith("Notion idea:"))).toBe(true);
    expect(notesAfter.some((t) => t.startsWith("GitLab idea:"))).toBe(true);
    expect(await getConnection(env, me, "notion")).toBeNull();
    expect(await getConnection(env, me, "gitlab")).toMatchObject({ status: "active" });
  });

  it("shows imported work per provider, with nothing sensitive in the view", async () => {
    fakeComposio();
    const me = user();
    const app = testApp(fakeDeps({ env: keyed }).deps);
    await connect(app, me, "gitlab");
    const body = (await (await app.request(me, "GET")).json()) as { connections: View[] };
    const gitlab = body.connections.find((v) => v.id === "gitlab");
    expect(gitlab).toMatchObject({ status: "connected", projects: [{ name: "thesis-pipeline" }, { name: "notes" }] });
    expect(JSON.stringify(body)).not.toMatch(/ca_gitlab|glpat-|owner@example|ownerid/);
  });
});
