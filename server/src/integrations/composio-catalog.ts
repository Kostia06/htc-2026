import type { Env } from "../env";
import { authConfigIds, composio, ComposioError, forgetAuthConfigs } from "./composio";

// Composio's app catalog (~1,700 toolkits). Only names, logos and whether sign-in is possible are read from it.

export type Toolkit = { slug: string; name: string; logo?: string; category?: string; managedAuth: boolean };

type RawToolkit = {
  slug?: unknown;
  name?: unknown;
  no_auth?: unknown;
  composio_managed_auth_schemes?: unknown;
  meta?: { logo?: unknown; categories?: { name?: unknown }[] };
};

// a generous page; the search box can ask for the next one
const PAGE_SIZE = 100;
const INFO_TTL_MS = 60 * 60 * 1000;
const info = new Map<string, { at: number; toolkit: Toolkit | null }>();

function toolkitOf(raw: RawToolkit): Toolkit | null {
  if (typeof raw.slug !== "string" || typeof raw.name !== "string") return null;
  const logo = typeof raw.meta?.logo === "string" && raw.meta.logo.startsWith("https://") ? raw.meta.logo : undefined;
  const category = raw.meta?.categories?.find((c) => typeof c.name === "string")?.name as string | undefined;
  const schemes = Array.isArray(raw.composio_managed_auth_schemes) ? raw.composio_managed_auth_schemes : [];
  // a toolkit with no auth has nothing to connect; one without managed auth would need our own OAuth app first
  return { slug: raw.slug.toLowerCase(), name: raw.name, logo, category, managedAuth: raw.no_auth !== true && schemes.length > 0 };
}

/** One page of toolkits matching a query, in Composio's order, and the cursor for the next page. An empty query lists them all. */
export async function searchToolkits(env: Env, query: string, cursor?: string): Promise<{ toolkits: Toolkit[]; next?: string }> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), ...(query ? { search: query } : {}), ...(cursor ? { cursor } : {}) });
  const page = await composio<{ items?: RawToolkit[]; next_cursor?: unknown }>(env, { method: "GET", path: `/toolkits?${params}`, what: "app search" });
  const toolkits = (page.items ?? []).map(toolkitOf).filter((t): t is Toolkit => t !== null).slice(0, PAGE_SIZE);
  return { toolkits, ...(typeof page.next_cursor === "string" && page.next_cursor ? { next: page.next_cursor } : {}) };
}

/** One toolkit's name and logo, cached for an hour; null when Composio has no such toolkit. */
export async function toolkitInfo(env: Env, slug: string): Promise<Toolkit | null> {
  const hit = info.get(slug);
  if (hit && Date.now() - hit.at < INFO_TTL_MS) return hit.toolkit;
  let toolkit: Toolkit | null;
  try {
    toolkit = toolkitOf(await composio<RawToolkit>(env, { method: "GET", path: `/toolkits/${encodeURIComponent(slug)}`, what: "app lookup" }));
  } catch (e) {
    if (e instanceof ComposioError && e.status === 404) toolkit = null;
    else throw e;
  }
  info.set(slug, { at: Date.now(), toolkit });
  return toolkit;
}

/**
 * The project's enabled auth config for a toolkit, creating a Composio-managed one the first time someone connects it.
 * Null when there is none and Composio can't manage this app's sign-in.
 */
export async function ensureAuthConfig(env: Env, slug: string): Promise<string | null> {
  const existing = (await authConfigIds(env, [slug])).get(slug);
  if (existing) return existing;
  const toolkit = await toolkitInfo(env, slug);
  if (!toolkit?.managedAuth) return null;
  const body = { toolkit: { slug }, auth_config: { type: "use_composio_managed_auth", name: `Skillit ${toolkit.name}` } };
  const created = await composio<{ auth_config?: { id?: unknown } }>(env, { method: "POST", path: "/auth_configs", what: "auth config create", body });
  forgetAuthConfigs();
  if (typeof created.auth_config?.id !== "string") throw new ComposioError("auth config create", 502);
  return created.auth_config.id;
}
