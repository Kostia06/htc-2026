import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConnection } from "../../src/connections/store";
import { fakeDeps } from "../agents/fakes";
import { keyed } from "../connections/fixtures";
import { testApp } from "./connections-app";

afterEach(() => vi.restoreAllMocks());

const user = () => `apps-${crypto.randomUUID()}`;

type Call = { path: string; search: string; method: string; body?: Record<string, unknown> };

const toolkit = (slug: string, name: string, managed: boolean, extra: Record<string, unknown> = {}) => ({
  slug,
  name,
  composio_managed_auth_schemes: managed ? ["OAUTH2"] : [],
  meta: { logo: `https://logos.composio.dev/api/${slug}`, categories: [{ id: "x", name: "productivity" }] },
  ...extra,
});

const CATALOG = [
  toolkit("linear", "Linear", true),
  toolkit("gitea", "Gitea", false),
  toolkit("customerco", "CustomerCo", false),
  toolkit("noauthy", "NoAuthy", true, { no_auth: true }),
  toolkit("github", "GitHub", true),
];

/** Composio's catalog, auth configs and connected accounts, recording every request. customerco has a hand-made config. */
function fakeCatalog(over: { status?: string } = {}) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    const path = url.pathname.replace("/api/v3.1", "");
    calls.push({ path, search: url.search, method, body });
    if (path === "/toolkits") return Response.json({ items: CATALOG, next_cursor: "Y3Vyc29yMg==" });
    if (path.startsWith("/toolkits/")) {
      const found = CATALOG.find((t) => t.slug === path.split("/")[2]);
      return found ? Response.json(found) : Response.json({ error: "nope" }, { status: 404 });
    }
    if (path === "/auth_configs" && method === "GET") return Response.json({ items: [{ id: "ac_customerco", status: "ENABLED", toolkit: { slug: "customerco" } }] });
    if (path === "/auth_configs" && method === "POST") return Response.json({ toolkit: { slug: "x" }, auth_config: { id: `ac_new_${(body?.toolkit as { slug: string }).slug}`, auth_scheme: "OAUTH2", is_composio_managed: true } }, { status: 201 });
    if (path === "/connected_accounts/link") return Response.json({ redirect_url: "https://connect.composio.dev/link/ln_app", connected_account_id: `ca_${String(body?.auth_config_id)}` }, { status: 201 });
    if (path.startsWith("/connected_accounts/") && method === "GET") return Response.json({ status: over.status ?? "ACTIVE" });
    if (path.startsWith("/connected_accounts/") && method === "DELETE") return Response.json({ success: true });
    if (path.startsWith("/tools/")) throw new Error("no tool may ever run on a plain app");
    return new Response("not faked", { status: 500 });
  });
  return calls;
}

describe("/api/connections/catalog", () => {
  it("searches Composio's catalog and says which apps can be connected and which are curated", async () => {
    const calls = fakeCatalog();
    const res = await testApp(fakeDeps({ env: keyed }).deps).request(user(), "GET", "/catalog?q=lin");
    expect(res.status).toBe(200);
    const { apps } = (await res.json()) as { apps: Record<string, unknown>[] };
    expect(apps).toEqual([
      { slug: "linear", name: "Linear", logo: "https://logos.composio.dev/api/linear", category: "productivity", connectable: true, curated: false },
      expect.objectContaining({ slug: "gitea", connectable: false }),
      expect.objectContaining({ slug: "customerco", connectable: true }),
      expect.objectContaining({ slug: "noauthy", connectable: false }),
      expect.objectContaining({ slug: "github", curated: true }),
    ]);
    const search = calls.find((c) => c.path === "/toolkits");
    expect(new URLSearchParams(search?.search).get("search")).toBe("lin");
    expect(new URLSearchParams(search?.search).get("limit")).toBe("100");
  });

  it("passes a page cursor through, and drops one that isn't Composio's", async () => {
    const calls = fakeCatalog();
    const { request } = testApp(fakeDeps({ env: keyed }).deps);
    const first = (await (await request(user(), "GET", "/catalog?q=a")).json()) as { next?: string };
    expect(first.next).toBe("Y3Vyc29yMg==");
    await request(user(), "GET", `/catalog?q=a&cursor=${encodeURIComponent("Y3Vyc29yMg==")}`);
    await request(user(), "GET", `/catalog?q=a&cursor=${encodeURIComponent("x&search=evil")}`);
    const cursors = calls.filter((c) => c.path === "/toolkits").map((c) => new URLSearchParams(c.search).get("cursor"));
    expect(cursors).toEqual([null, "Y3Vyc29yMg==", null]);
  });

  it("answers empty without a Composio key, without calling out", async () => {
    const calls = fakeCatalog();
    const res = await testApp(fakeDeps().deps, env).request(user(), "GET", "/catalog?q=x");
    expect(await res.json()).toEqual({ apps: [], configured: false });
    expect(calls).toEqual([]);
  });
});

describe("/api/connections/apps/:slug", () => {
  it("refuses a slug that isn't a toolkit name before anything reaches Composio", async () => {
    const calls = fakeCatalog();
    const { request } = testApp(fakeDeps({ env: keyed }).deps);
    for (const bad of ["Linear", "lin%2Fear", "a.b", "x".repeat(61), "%20"]) expect((await request(user(), "POST", `/apps/${bad}`, {})).status).toBe(400);
    expect((await request(user(), "POST", "/apps/github", {})).status).toBe(409);
    expect(calls).toEqual([]);
  });

  it("creates a managed auth config on first connect, then lists and disconnects the app, never running a tool", async () => {
    const calls = fakeCatalog();
    const { request } = testApp(fakeDeps({ env: keyed }).deps);
    const me = user();
    const res = await request(me, "POST", "/apps/linear", { returnTo: "skillit://connections" });
    expect(await res.json()).toEqual({ url: "https://connect.composio.dev/link/ln_app" });
    expect(calls.find((c) => c.path === "/auth_configs" && c.method === "POST")?.body).toEqual({ toolkit: { slug: "linear" }, auth_config: { type: "use_composio_managed_auth", name: "Skillit Linear" } });
    const link = calls.find((c) => c.path === "/connected_accounts/link");
    expect(link?.body).toEqual({ auth_config_id: "ac_new_linear", user_id: expect.stringMatching(/^skillit_[0-9a-f]{32}$/), callback_url: "skillit://connections" });

    const list = (await (await request(me, "GET")).json()) as { apps: unknown[]; connections: unknown[] };
    expect(list.apps).toEqual([{ slug: "linear", name: "Linear", logo: "https://logos.composio.dev/api/linear", status: "connected" }]);
    expect(list.connections.length).toBeGreaterThan(0);
    expect((await request(me, "POST", "/apps/linear", {})).status).toBe(409);

    const del = await request(me, "DELETE", "/apps/linear");
    expect(await del.json()).toEqual({ apps: [] });
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/connected_accounts/ca_ac_new_linear")).toBe(true);
    expect(await getConnection(keyed, me, "app:linear")).toBeNull();
    expect(calls.some((c) => c.path.startsWith("/tools/"))).toBe(false);
  });

  it("reuses an auth config the project already has", async () => {
    const calls = fakeCatalog({ status: "INITIATED" });
    const { request } = testApp(fakeDeps({ env: keyed }).deps);
    const me = user();
    await request(me, "POST", "/apps/customerco", {});
    expect(calls.some((c) => c.path === "/auth_configs" && c.method === "POST")).toBe(false);
    expect(((await (await request(me, "GET")).json()) as { apps: unknown[] }).apps).toEqual([expect.objectContaining({ slug: "customerco", status: "pending" })]);
  });

  it("says an app Composio can't manage sign-in for can't be connected", async () => {
    fakeCatalog();
    const { request } = testApp(fakeDeps({ env: keyed }).deps);
    expect((await request(user(), "POST", "/apps/gitea", {})).status).toBe(422);
    expect((await request(user(), "POST", "/apps/doesnotexist", {})).status).toBe(422);
  });
});
