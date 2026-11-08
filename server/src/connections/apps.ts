import type { Env } from "../env";
import { authConfigIds, connectionStatus, deleteConnection, linkWith } from "../integrations/composio";
import { ensureAuthConfig, searchToolkits, toolkitInfo } from "../integrations/composio-catalog";
import { composioUserId } from "./identity";
import { CONNECTORS } from "./registry";
import { ENDED, safeReturnUrl } from "./sign-in";
import { connectedProviders, deleteConnectionRow, getConnection, setStatus, startConnection, type AppProvider } from "./store";

// Any app in Composio's catalog beyond the curated connectors. These are only ever connected and disconnected: no tool is
// executed on them, so nothing is read from or written to the service, and the row says nothing has been imported.

export type CatalogEntry = { slug: string; name: string; logo?: string; category?: string; connectable: boolean; curated: boolean };
export type AppView = { slug: string; name: string; logo?: string; status: "pending" | "connected" | "revoking" };

export class AppNotConnectable extends Error {}

const SLUG = /^[a-z0-9_-]{1,60}$/;
const QUERY_MAX = 80;
const PREFIX = "app:";

export const validAppSlug = (slug: string) => SLUG.test(slug);
export const isAppProvider = (provider: string): provider is AppProvider => provider.startsWith(PREFIX);
const providerOf = (slug: string): AppProvider => `${PREFIX}${slug}`;
const curatedToolkits = () => new Set(CONNECTORS.map((c) => c.toolkit));
// the curated ones keep their own rows and routes, so they're never connected a second time as a plain app
export const isCurated = (slug: string) => curatedToolkits().has(slug);

/** Catalog matches for a search box: connectable when the project has an auth config or Composio can make one for us. */
export async function searchCatalog(env: Env, query: string): Promise<CatalogEntry[]> {
  const toolkits = await searchToolkits(env, query.trim().slice(0, QUERY_MAX));
  const configured = await authConfigIds(env, toolkits.map((t) => t.slug));
  const curated = curatedToolkits();
  return toolkits.map(({ slug, name, logo, category, managedAuth }) => ({
    slug,
    name,
    ...(logo ? { logo } : {}),
    ...(category ? { category } : {}),
    connectable: configured.has(slug) || managedAuth,
    curated: curated.has(slug),
  }));
}

/** Starts the hosted sign-in, adding a Composio-managed auth config for the app the first time anyone connects it. */
export async function connectApp(env: Env, userId: string, slug: string, returnTo?: unknown) {
  const authConfigId = await ensureAuthConfig(env, slug);
  if (!authConfigId) throw new AppNotConnectable(`${slug} can't be connected yet`);
  const link = await linkWith(env, authConfigId, await composioUserId(env, userId), safeReturnUrl(env, returnTo));
  await startConnection(env, userId, providerOf(slug), link.accountId);
  return { url: link.url };
}

async function appView(env: Env, userId: string, provider: AppProvider): Promise<AppView | null> {
  const connection = await getConnection(env, userId, provider);
  if (!connection) return null;
  let status = connection.status;
  if (status === "pending") {
    const remote = await connectionStatus(env, connection.accountId);
    if (ENDED.has(remote)) {
      await deleteConnectionRow(env, userId, provider);
      return null;
    }
    if (remote === "ACTIVE") {
      await setStatus(env, userId, provider, "active");
      status = "active";
    }
  }
  const slug = provider.slice(PREFIX.length);
  const toolkit = await toolkitInfo(env, slug).catch(() => null);
  return { slug, name: toolkit?.name ?? slug, ...(toolkit?.logo ? { logo: toolkit.logo } : {}), status: status === "active" ? "connected" : status };
}

/** The person's connected (or connecting) apps, by name. */
export async function listApps(env: Env, userId: string): Promise<AppView[]> {
  const providers = (await connectedProviders(env, userId)).filter(isAppProvider);
  const views = await Promise.all(providers.map((p) => appView(env, userId, p)));
  return views.filter((v): v is AppView => v !== null).sort((a, b) => a.name.localeCompare(b.name));
}

export const appViewFor = (env: Env, userId: string, slug: string) => appView(env, userId, providerOf(slug));

/** Deletes the connection at Composio (revoking the token) and then our row; the row stays as 'revoking' if Composio fails. */
export async function disconnectApp(env: Env, userId: string, provider: AppProvider): Promise<void> {
  const connection = await getConnection(env, userId, provider);
  if (!connection) return;
  try {
    await deleteConnection(env, connection.accountId);
  } catch (e) {
    await setStatus(env, userId, provider, "revoking");
    throw e;
  }
  await deleteConnectionRow(env, userId, provider);
}

export const disconnectAppSlug = (env: Env, userId: string, slug: string) => disconnectApp(env, userId, providerOf(slug));
