import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConnection } from "../../src/connections/store";
import { listMemories } from "../../src/memory/private/store";
import { getProfile, updateProfile } from "../../src/memory/profile/store";
import { call, fakeDeps } from "../agents/fakes";
import { fakeComposio, keyed } from "../connections/fixtures";
import { testApp } from "./connections-app";

afterEach(() => vi.restoreAllMocks());

const summary = call("finish", {
  projects: [{ name: "budget-bot", summary: "Telegram bot in Python that tracks shared expenses", evidence: "A Telegram bot that tracks shared expenses for roommates" }],
});

const user = () => `gh-${crypto.randomUUID()}`;

async function connected(me: string, replies = [summary]) {
  const scripted = fakeDeps({ env: keyed, replies });
  const app = testApp(scripted.deps);
  await app.request(me, "POST", "/github", { returnTo: "skillit://connections/github" });
  const res = await app.request(me, "GET");
  await app.settle();
  return { ...app, scripted, first: (await res.json()) as { github: { importing: boolean } } };
}

describe("/api/connections", () => {
  it("reports not configured cleanly without a Composio key", async () => {
    const { calls } = fakeComposio();
    const { request } = testApp(fakeDeps().deps, env);
    expect(await (await request(user(), "GET")).json()).toMatchObject({ github: { configured: false, status: "not_connected", projects: [], suggestions: [], importing: false } });
    const post = await request(user(), "POST", "/github", {});
    expect(post.status).toBe(503);
    expect(await post.json()).toMatchObject({ configured: false });
    expect(calls).toEqual([]);
  });

  it("hands back a Composio sign-in under a pseudonym, returning only to our own app", async () => {
    const { calls } = fakeComposio();
    const { request } = testApp(fakeDeps({ env: keyed }).deps);
    const me = user();
    const res = await request(me, "POST", "/github", { returnTo: "skillit://connections/github" });
    expect(await res.json()).toEqual({ url: "https://connect.composio.dev/link/ln_1" });
    expect(calls[0].body).toEqual({ auth_config_id: "ac_test", user_id: expect.stringMatching(/^skillit_[0-9a-f]{32}$/), callback_url: "skillit://connections/github" });
    expect(JSON.stringify(calls[0].body)).not.toContain(me);

    expect(await (await request(me, "GET")).json()).toMatchObject({ github: { status: "connected" } });
    expect((await request(me, "POST", "/github", {})).status).toBe(409);
  });

  it("drops a return address that isn't ours", async () => {
    const { calls } = fakeComposio({ status: "INITIATED" });
    const { request } = testApp(fakeDeps({ env: keyed }).deps);
    await request(user(), "POST", "/github", { returnTo: "https://evil.example/steal" });
    const link = calls.find((c) => c.url.endsWith("/connected_accounts/link"));
    expect(link?.body).not.toHaveProperty("callback_url");
  });

  it("imports grounded projects and private notes once the sign-in finishes, with nothing sensitive reaching the model", async () => {
    fakeComposio();
    const me = user();
    const { request, first, scripted } = await connected(me);
    expect(first.github.importing).toBe(true);

    const goal = JSON.stringify(scripted.conversations[0]);
    for (const leak of ["jordan@example.com", "ghp_", "gho_", "https://", "ABCdefGhIJKlmnoPQRstuVWxyz", "secret-startup", "temp_clone_token"]) expect(goal).not.toContain(leak);
    expect(goal).toContain("<untrusted-web-content>");

    const profile = await getProfile(env, me);
    expect(profile.projects).toEqual([{ name: "budget-bot", summary: "Telegram bot in Python that tracks shared expenses" }, { name: "dotfiles" }]);
    const notes = (await listMemories(env, me)).map((m) => m.text);
    expect(notes).toEqual([expect.stringContaining("Add a README to dotfiles")]);

    const view = (await (await request(me, "GET")).json()) as { github: Record<string, unknown> };
    // the apps stop waiting once importedAt is set, whether or not anything was found
    expect(view.github).toMatchObject({ status: "connected", importing: false, importedAt: expect.any(String), projects: [{ name: "budget-bot", language: "Python" }, { name: "dotfiles", language: "Shell" }] });
    expect(JSON.stringify(view)).not.toMatch(/ca_1|gho_|jordan@|owner|token/);
  });

  it("keeps a project the person already had, and disconnecting deletes only what the import added", async () => {
    const { calls } = fakeComposio();
    const me = user();
    await updateProfile(env, me, { projects: [{ name: "dotfiles", summary: "My own words" }] });
    const { request } = await connected(me);
    expect((await getProfile(env, me)).projects).toContainEqual({ name: "dotfiles", summary: "My own words" });

    const res = await request(me, "DELETE", "/github");
    expect(await res.json()).toMatchObject({ github: { status: "not_connected" } });
    expect(calls.filter((c) => c.method === "DELETE").map((c) => c.url)).toEqual(["https://backend.composio.dev/api/v3.1/connected_accounts/ca_1?revoke_on_delete=true"]);
    expect((await getProfile(env, me)).projects).toEqual([{ name: "dotfiles", summary: "My own words" }]);
    expect(await listMemories(env, me)).toEqual([]);
    expect(await getConnection(env, me, "github")).toBeNull();
  });

  it("still deletes the derived data when Composio can't be reached, and keeps the row to retry the revoke", async () => {
    fakeComposio({ deleteStatus: 500 });
    const me = user();
    const { request } = await connected(me);
    expect((await request(me, "DELETE", "/github")).status).toBe(502);
    expect((await getProfile(env, me)).projects).toEqual([]);
    expect(await listMemories(env, me)).toEqual([]);
    expect(await getConnection(env, me, "github")).toMatchObject({ status: "revoking", derived: undefined });
  });

  it("falls back to each repo's own description when the model fails", async () => {
    fakeComposio();
    const me = user();
    await connected(me, []);
    expect((await getProfile(env, me)).projects[0]).toEqual({ name: "budget-bot", summary: "Splits rent and groceries between roommates. Mail [email]" });
  });

  it("imports on demand only when connected", async () => {
    fakeComposio({ status: "INITIATED" });
    const me = user();
    const { request } = testApp(fakeDeps({ env: keyed }).deps);
    await request(me, "POST", "/github", {});
    expect(await (await request(me, "GET")).json()).toMatchObject({ github: { status: "pending" } });
    expect((await request(me, "POST", "/github/import")).status).toBe(409);
  });
});
