import type { Env } from "../env";
import { composio, ComposioError } from "../integrations/composio";
import { listApps, validAppSlug } from "./apps";
import { composioUserId } from "./identity";
import { assertReadOnlyAppTool, readOnlyTool, WriteToolRefused } from "./read-only";
import { getConnection } from "./store";

// What Skillit's agents may do with a person's other connected apps: see which ones there are, see their read tools, and
// run one read. Every run passes the by-name check before any request, then Composio's own metadata for that exact tool.

export class AppNotConnected extends Error {}

export type AppReadTool = { slug: string; description: string; parameters: Record<string, unknown> };

type RawTool = { slug: string; description?: unknown; version?: unknown; tags?: unknown; toolkit?: { slug?: unknown }; input_parameters?: unknown };

const MAX_TOOLS = 40;
const DESCRIPTION_MAX = 300;
const ARGS_MAX = 4000;

/** The person's apps that finished signing in, by slug and name. */
export async function connectedAppsFor(env: Env, userId: string) {
  return (await listApps(env, userId)).filter((a) => a.status === "connected").map(({ slug, name }) => ({ slug, name }));
}

async function activeAccount(env: Env, userId: string, app: string): Promise<string> {
  if (!validAppSlug(app)) throw new AppNotConnected(`${app} isn't an app name`);
  const connection = await getConnection(env, userId, `app:${app}`);
  if (connection?.status !== "active") throw new AppNotConnected(`${app} isn't connected`);
  return connection.accountId;
}

// only the shape the model needs to call the tool: parameter names, types and short descriptions
function compactParameters(raw: unknown): Record<string, unknown> {
  const schema = (raw ?? {}) as { properties?: Record<string, { type?: unknown; description?: unknown }>; required?: unknown };
  const properties = Object.fromEntries(
    Object.entries(schema.properties ?? {}).slice(0, 15).map(([name, p]) => [name, { type: p.type, description: typeof p.description === "string" ? p.description.slice(0, 150) : undefined }]),
  );
  return { properties, required: Array.isArray(schema.required) ? schema.required : [] };
}

/** The read-only tools one connected app offers, optionally narrowed by a search phrase. */
export async function readToolsFor(env: Env, userId: string, app: string, search?: string): Promise<AppReadTool[]> {
  await activeAccount(env, userId, app);
  const params = new URLSearchParams({ toolkit_slug: app, limit: "200", ...(search ? { search: search.slice(0, 80) } : {}) });
  const { items = [] } = await composio<{ items?: RawTool[] }>(env, { method: "GET", path: `/tools?${params}`, what: "tool list" });
  return items
    .filter((t) => typeof t.slug === "string" && readOnlyTool(t, app))
    .slice(0, MAX_TOOLS)
    .map((t) => ({ slug: t.slug, description: typeof t.description === "string" ? t.description.slice(0, DESCRIPTION_MAX) : "", parameters: compactParameters(t.input_parameters) }));
}

/** Runs one read on the person's own connection to that app. Anything that isn't a read is refused before any request. */
export async function runAppRead(env: Env, userId: string, app: string, tool: string, args: Record<string, unknown>): Promise<unknown> {
  assertReadOnlyAppTool(app, tool);
  if (JSON.stringify(args).length > ARGS_MAX) throw new Error("those arguments are too long");
  const accountId = await activeAccount(env, userId, app);
  const meta = await composio<RawTool>(env, { method: "GET", path: `/tools/${encodeURIComponent(tool)}`, what: "tool lookup" });
  if (!readOnlyTool({ ...meta, slug: tool }, app)) throw new WriteToolRefused(tool, app);
  const body = {
    user_id: await composioUserId(env, userId),
    connected_account_id: accountId,
    ...(typeof meta.version === "string" ? { version: meta.version } : {}),
    arguments: args,
  };
  const result = await composio<{ data?: unknown; successful?: unknown }>(env, { method: "POST", path: `/tools/execute/${tool}`, what: tool, body });
  if (result.successful !== true) throw new ComposioError(tool, 502);
  return result.data;
}
