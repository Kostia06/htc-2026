import { assertReadOnlyTool } from "../connections/github/read-only";
import type { Env } from "../env";

// REST v3.1 (https://docs.composio.dev/reference): plain fetch, so nothing but the Workers runtime is needed
const API = "https://backend.composio.dev/api/v3.1";
// pinned so a tool's response shape can't change under the import; the GitHub toolkit's version on 2026-11-03
export const GITHUB_TOOLKIT_VERSION = "20261103_00";

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
  if (!key) throw new ComposioNotConfigured("GitHub isn't set up on this server yet");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ComposioError(what, res.status);
  return (await res.json()) as T;
}

type AuthConfig = { id?: unknown; status?: unknown; is_disabled?: unknown };

// the owner may pin one; otherwise the project's first enabled GitHub auth config
async function githubAuthConfigId(env: Env): Promise<string> {
  if (env.COMPOSIO_GITHUB_AUTH_CONFIG_ID) return env.COMPOSIO_GITHUB_AUTH_CONFIG_ID;
  const { items = [] } = await composio<{ items?: AuthConfig[] }>(env, { method: "GET", path: "/auth_configs?toolkit_slug=github", what: "auth config lookup" });
  const config = items.find((c) => typeof c.id === "string" && c.status !== "DISABLED" && c.is_disabled !== true);
  if (!config) throw new ComposioNotConfigured("no GitHub auth config exists in the Composio project yet");
  return config.id as string;
}

/** Starts a hosted GitHub sign-in for one person. Composio keeps the OAuth token; we get its connection id. */
export async function createGithubLink(env: Env, composioUserId: string, callbackUrl?: string) {
  const body = { auth_config_id: await githubAuthConfigId(env), user_id: composioUserId, ...(callbackUrl ? { callback_url: callbackUrl } : {}) };
  const link = await composio<{ redirect_url?: unknown; connected_account_id?: unknown }>(env, { method: "POST", path: "/connected_accounts/link", what: "link", body });
  if (typeof link.redirect_url !== "string" || typeof link.connected_account_id !== "string") throw new ComposioError("link", 502);
  return { url: link.redirect_url, accountId: link.connected_account_id };
}

/** Only the status is read off the account; its state (where credential fields live) is never touched. */
export async function connectionStatus(env: Env, accountId: string): Promise<string> {
  const account = await composio<{ status?: unknown }>(env, { method: "GET", path: `/connected_accounts/${encodeURIComponent(accountId)}`, what: "status" });
  return typeof account.status === "string" ? account.status : "UNKNOWN";
}

/** Deletes the connection and asks Composio to revoke the token at GitHub. A connection that's already gone counts as done. */
export async function deleteConnection(env: Env, accountId: string): Promise<void> {
  try {
    await composio(env, { method: "DELETE", path: `/connected_accounts/${encodeURIComponent(accountId)}?revoke_on_delete=true`, what: "delete" });
  } catch (e) {
    if (e instanceof ComposioError && e.status === 404) return;
    throw e;
  }
}

type Execution = { data?: unknown; successful?: unknown };

/** Runs one allowlisted read for one person's connection; anything else is refused before a request is made. */
export async function executeReadTool(env: Env, slug: string, call: { userId: string; accountId: string; args: Record<string, unknown> }) {
  assertReadOnlyTool(slug);
  const body = { user_id: call.userId, connected_account_id: call.accountId, version: GITHUB_TOOLKIT_VERSION, arguments: call.args };
  const result = await composio<Execution>(env, { method: "POST", path: `/tools/execute/${slug}`, what: slug, body });
  if (result.successful !== true) throw new ComposioError(slug, 502);
  return result.data;
}
