import type { Env } from "../../env";
import { composioConfigured, connectionStatus, createGithubLink, deleteConnection } from "../../integrations/composio";
import { allowedOrigins } from "../../lib/cors";
import { deleteConnectionRow, getConnection, saveDerived, setStatus, startConnection, type Connection, type RepoSummary } from "../store";
import { composioUserId } from "./identity";
import { removeImported } from "./import";

export type GithubView = {
  configured: boolean;
  status: "not_connected" | "pending" | "connected" | "revoking";
  importedAt?: string;
  projects: Pick<RepoSummary, "name" | "summary" | "language">[];
  suggestions: string[];
};

const APP_SCHEME = "skillit://";
// Composio's terminal states for a sign-in that will never finish
const ENDED = new Set(["FAILED", "EXPIRED", "INACTIVE", "REVOKED", "DELETED"]);

// only back into our own app or one of our own web origins, so the link can't be used to bounce someone elsewhere
export function safeReturnUrl(env: Env, returnTo: unknown): string | undefined {
  if (typeof returnTo !== "string" || returnTo.length > 300) return undefined;
  if (returnTo.startsWith(APP_SCHEME)) return returnTo;
  try {
    return allowedOrigins(env.ALLOWED_ORIGINS).includes(new URL(returnTo).origin) ? returnTo : undefined;
  } catch {
    return undefined;
  }
}

function viewOf(env: Env, connection: Connection | null): GithubView {
  const configured = composioConfigured(env);
  if (!connection) return { configured, status: "not_connected", projects: [], suggestions: [] };
  const status = connection.status === "active" ? "connected" : connection.status;
  const repos = connection.derived?.repos ?? [];
  return {
    configured,
    status,
    importedAt: connection.importedAt,
    projects: repos.map(({ name, summary, language }) => ({ name, summary, language })),
    suggestions: connection.derived?.suggestions ?? [],
  };
}

export async function startGithubConnect(env: Env, userId: string, returnTo?: unknown) {
  const link = await createGithubLink(env, await composioUserId(env, userId), safeReturnUrl(env, returnTo));
  await startConnection(env, userId, "github", link.accountId);
  return { url: link.url };
}

/** The person's GitHub state. A pending sign-in is checked with Composio; justConnected says it finished just now. */
export async function githubStatus(env: Env, userId: string): Promise<{ view: GithubView; justConnected: boolean }> {
  const connection = await getConnection(env, userId, "github");
  if (connection?.status !== "pending" || !composioConfigured(env)) return { view: viewOf(env, connection), justConnected: false };
  const remote = await connectionStatus(env, connection.accountId);
  if (remote === "ACTIVE") {
    await setStatus(env, userId, "github", "active");
    return { view: viewOf(env, { ...connection, status: "active" }), justConnected: true };
  }
  if (ENDED.has(remote)) {
    await deleteConnectionRow(env, userId, "github");
    return { view: viewOf(env, null), justConnected: false };
  }
  return { view: viewOf(env, connection), justConnected: false };
}

/**
 * Deletes the connection at Composio (which revokes the token at GitHub), then everything the import derived. If Composio
 * can't be reached the derived data still goes, and the row stays as 'revoking' so a retry can finish the job.
 */
export async function disconnectGithub(env: Env, userId: string): Promise<{ disconnected: boolean }> {
  const connection = await getConnection(env, userId, "github");
  if (!connection) return { disconnected: true };
  await removeImported(env, userId, connection.derived);
  try {
    await deleteConnection(env, connection.accountId);
  } catch (e) {
    await saveDerived(env, userId, null);
    await setStatus(env, userId, "github", "revoking");
    throw e;
  }
  await deleteConnectionRow(env, userId, "github");
  return { disconnected: true };
}
