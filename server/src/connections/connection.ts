import type { Env } from "../env";
import { authConfigIds, connectionStatus, createLink, deleteConnection } from "../integrations/composio";
import { disconnectApp, isAppProvider } from "./apps";
import { composioUserId } from "./identity";
import { removeImported } from "./import";
import { CONNECTORS } from "./registry";
import { ENDED, safeReturnUrl } from "./sign-in";
import { connectedProviders, deleteConnectionRow, getConnection, saveDerived, setStatus, startConnection, type Connection } from "./store";
import type { Category, Connector, ProviderId, WorkItem } from "./types";

export type ConnectionView = {
  id: ProviderId;
  name: string;
  category: Category;
  reads: string;
  // false when the server has no Composio key or the project has no auth config for this service: shown as "coming soon"
  configured: boolean;
  status: "not_connected" | "pending" | "connected" | "revoking";
  importing: boolean;
  importedAt?: string;
  projects: Pick<WorkItem, "name" | "summary" | "language" | "kind">[];
  suggestions: string[];
};

function viewOf(connector: Connector, configured: boolean, connection: Connection | null, importing = false): ConnectionView {
  const base = { id: connector.id, name: connector.name, category: connector.category, reads: connector.reads, configured, importing };
  if (!connection) return { ...base, status: "not_connected", projects: [], suggestions: [] };
  const items = connection.derived?.items ?? [];
  return {
    ...base,
    status: connection.status === "active" ? "connected" : connection.status,
    importedAt: connection.importedAt,
    projects: items.map(({ name, summary, language, kind }) => ({ name, summary, language, kind })),
    suggestions: connection.derived?.suggestions ?? [],
  };
}

export async function isConfigured(env: Env, connector: Connector) {
  return (await authConfigIds(env, [connector.toolkit])).has(connector.toolkit);
}

export async function startConnect(env: Env, userId: string, connector: Connector, returnTo?: unknown) {
  const link = await createLink(env, connector.toolkit, await composioUserId(env, userId), safeReturnUrl(env, returnTo));
  await startConnection(env, userId, connector.id, link.accountId);
  return { url: link.url };
}

/** One provider's state. A pending sign-in is checked with Composio; justConnected says it finished just now. */
async function connectionState(env: Env, userId: string, connector: Connector, configured: boolean) {
  const connection = await getConnection(env, userId, connector.id);
  if (connection?.status !== "pending" || !configured) return { connection, justConnected: false };
  const remote = await connectionStatus(env, connection.accountId);
  if (remote === "ACTIVE") {
    await setStatus(env, userId, connector.id, "active");
    return { connection: { ...connection, status: "active" as const }, justConnected: true };
  }
  if (ENDED.has(remote)) {
    await deleteConnectionRow(env, userId, connector.id);
    return { connection: null, justConnected: false };
  }
  return { connection, justConnected: false };
}

/** Every provider, in the UI's order, with the ones whose sign-in just finished (their import should start now). */
export async function listConnections(env: Env, userId: string): Promise<{ views: ConnectionView[]; justConnected: Connector[] }> {
  const configuredIds = await authConfigIds(env, CONNECTORS.map((c) => c.toolkit));
  const justConnected: Connector[] = [];
  const views = await Promise.all(
    CONNECTORS.map(async (connector) => {
      const configured = configuredIds.has(connector.toolkit);
      const state = await connectionState(env, userId, connector, configured);
      if (state.justConnected) justConnected.push(connector);
      return viewOf(connector, configured, state.connection, state.justConnected);
    }),
  );
  return { views, justConnected };
}

export async function viewFor(env: Env, userId: string, connector: Connector): Promise<ConnectionView> {
  const configured = await isConfigured(env, connector);
  return viewOf(connector, configured, (await connectionState(env, userId, connector, configured)).connection);
}

/**
 * Deletes the connection at Composio (which revokes the token at the service), then everything that provider's import
 * derived, and nothing any other provider did. If Composio can't be reached the derived data still goes, and the row stays
 * as 'revoking' so a retry can finish the job.
 */
export async function disconnect(env: Env, userId: string, connector: Connector): Promise<void> {
  const connection = await getConnection(env, userId, connector.id);
  if (!connection) return;
  await removeImported(env, userId, connection.derived);
  try {
    await deleteConnection(env, connection.accountId);
  } catch (e) {
    await saveDerived(env, userId, connector.id, null);
    await setStatus(env, userId, connector.id, "revoking");
    throw e;
  }
  await deleteConnectionRow(env, userId, connector.id);
}

/** For deleting an account: tries every provider and app the person has, and names the ones Composio couldn't revoke. */
export async function disconnectAll(env: Env, userId: string): Promise<string[]> {
  const left: string[] = [];
  for (const provider of await connectedProviders(env, userId)) {
    if (isAppProvider(provider)) {
      await disconnectApp(env, userId, provider).catch(() => left.push(provider));
      continue;
    }
    const connector = CONNECTORS.find((c) => c.id === provider);
    if (!connector) continue;
    await disconnect(env, userId, connector).catch(() => left.push(provider));
  }
  return left;
}
