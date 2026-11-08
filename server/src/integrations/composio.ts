import { assertReadOnlyTool } from "../connections/read-only";
import type { Connector } from "../connections/types";
import type { Env } from "../env";

// REST v3.1 (https://docs.composio.dev/reference): plain fetch, so nothing but the Workers runtime is needed
const API = "https://backend.composio.dev/api/v3.1";

export class ComposioNotConfigured extends Error {}

// the message never carries Composio's body: an error response can echo back what was sent
export class ComposioError extends Error {
  readonly status: number;
  constructor(what: string, status: number) {
    super(`Composio ${what} failed (${status})`);
    this.status = status;
  }
}

export const composioConfigured = (env: Env) => Boolean(env.COMPOSIO_API_KEY);

type Request = { method: "GET" | "POST" | "DELETE"; path: string; what: string; body?: unknown };

async function composio<T>(env: Env, { method, path, what, body }: Request): Promise<T> {
  const key = env.COMPOSIO_API_KEY;
  if (!key) throw new ComposioNotConfigured("connecting accounts isn't set up on this server yet");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ComposioError(what, res.status);
  return (await res.json()) as T;
}

type AuthConfig = { id?: unknown; status?: unknown; is_disabled?: unknown; toolkit?: { slug?: unknown } };

// the auth configs barely change, and the app polls the status route while someone signs in: one lookup a minute is plenty
const AUTH_CONFIG_TTL_MS = 60_000;
let cached: { key: string; at: number; ids: Map<string, string> } | undefined;

async function lookUpAuthConfigs(env: Env, toolkits: string[]): Promise<Map<string, string>> {
  const query = `toolkit_slug=${encodeURIComponent(toolkits.join(","))}&limit=200`;
  const key = `${env.COMPOSIO_API_KEY}|${query}`;
  if (cached?.key === key && Date.now() - cached.at < AUTH_CONFIG_TTL_MS) return cached.ids;
  const { items = [] } = await composio<{ items?: AuthConfig[] }>(env, { method: "GET", path: `/auth_configs?${query}`, what: "auth config lookup" });
  const ids = new Map<string, string>();
  for (const config of items) {
    const toolkit = typeof config.toolkit?.slug === "string" ? config.toolkit.slug.toLowerCase() : undefined;
    // the project's first enabled config for a toolkit is the one used
    if (toolkit && typeof config.id === "string" && config.status !== "DISABLED" && config.is_disabled !== true && !ids.has(toolkit)) ids.set(toolkit, config.id);
  }
  cached = { key, at: Date.now(), ids };
  return ids;
}

/**
 * Which toolkits can be connected: those with an enabled auth config in the Composio project (GitHub's may be pinned by
 * COMPOSIO_GITHUB_AUTH_CONFIG_ID). No key means none; a failed lookup means none but the pinned one, never an error.
 */
export async function authConfigIds(env: Env, toolkits: string[]): Promise<Map<string, string>> {
  if (!composioConfigured(env)) return new Map();
  const pinned = new Map(env.COMPOSIO_GITHUB_AUTH_CONFIG_ID ? [["github", env.COMPOSIO_GITHUB_AUTH_CONFIG_ID]] : []);
  const unpinned = toolkits.filter((t) => !pinned.has(t));
  if (unpinned.length === 0) return pinned;
  const found = await lookUpAuthConfigs(env, unpinned).catch(() => new Map<string, string>());
  return new Map([...found, ...pinned]);
}

/** Starts a hosted sign-in for one person. Composio keeps the OAuth token; we get its connection id. */
export async function createLink(env: Env, toolkit: string, composioUserId: string, callbackUrl?: string) {
  const authConfigId = (await authConfigIds(env, [toolkit])).get(toolkit);
  if (!authConfigId) throw new ComposioNotConfigured(`no ${toolkit} auth config exists in the Composio project yet`);
  const body = { auth_config_id: authConfigId, user_id: composioUserId, ...(callbackUrl ? { callback_url: callbackUrl } : {}) };
  const link = await composio<{ redirect_url?: unknown; connected_account_id?: unknown }>(env, { method: "POST", path: "/connected_accounts/link", what: "link", body });
  if (typeof link.redirect_url !== "string" || typeof link.connected_account_id !== "string") throw new ComposioError("link", 502);
  return { url: link.redirect_url, accountId: link.connected_account_id };
}

/** Only the status is read off the account; its state (where credential fields live) is never touched. */
export async function connectionStatus(env: Env, accountId: string): Promise<string> {
  const account = await composio<{ status?: unknown }>(env, { method: "GET", path: `/connected_accounts/${encodeURIComponent(accountId)}`, what: "status" });
  return typeof account.status === "string" ? account.status : "UNKNOWN";
}

/** Deletes the connection and asks Composio to revoke the token at the service. A connection that's already gone counts as done. */
export async function deleteConnection(env: Env, accountId: string): Promise<void> {
  try {
    await composio(env, { method: "DELETE", path: `/connected_accounts/${encodeURIComponent(accountId)}?revoke_on_delete=true`, what: "delete" });
  } catch (e) {
    if (e instanceof ComposioError && e.status === 404) return;
    throw e;
  }
}

type Execution = { data?: unknown; successful?: unknown };

/** Runs one of the connector's allowlisted reads for one person's connection; anything else is refused before a request is made. */
export async function executeReadTool(env: Env, connector: Connector, slug: string, call: { userId: string; accountId: string; args: Record<string, unknown> }) {
  assertReadOnlyTool(connector, slug);
  const body = { user_id: call.userId, connected_account_id: call.accountId, version: connector.toolkitVersion, arguments: call.args };
  const result = await composio<Execution>(env, { method: "POST", path: `/tools/execute/${slug}`, what: slug, body });
  if (result.successful !== true) throw new ComposioError(slug, 502);
  return result.data;
}
