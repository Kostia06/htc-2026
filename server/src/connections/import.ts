import type { AgentDeps } from "../agents/core/types";
import type { Env } from "../env";
import { executeReadTool } from "../integrations/composio";
import { forget, remember } from "../memory/private/store";
import { getProfile, updateProfile } from "../memory/profile/store";
import { composioUserId } from "./identity";
import { getConnection, saveDerived, type Derived } from "./store";
import type { Connector, Reader, WorkItem } from "./types";

export class NotConnected extends Error {}

async function readerFor(env: Env, userId: string, connector: Connector): Promise<Reader> {
  const connection = await getConnection(env, userId, connector.id);
  if (connection?.status !== "active") throw new NotConnected(`${connector.name} isn't connected`);
  const composioUser = await composioUserId(env, userId);
  return (slug, args) => executeReadTool(env, connector, slug, { userId: composioUser, accountId: connection.accountId, args });
}

// projects the person already had (typed in, from their resume, or from another connector) are not this import's: it never
// overwrites or removes them, so disconnecting one service can't take away what another one, or the person, added
async function writeProfile(env: Env, userId: string, items: WorkItem[], previous?: Derived) {
  const ours = new Set((previous?.addedProjects ?? []).map((n) => n.toLowerCase()));
  const profile = await getProfile(env, userId);
  const theirs = new Set(profile.projects.map((p) => p.name.toLowerCase()).filter((n) => !ours.has(n)));
  const added = items.filter((item) => !theirs.has(item.name.toLowerCase())).map(({ name, summary }) => ({ name, summary }));
  await updateProfile(env, userId, {
    remove: previous?.addedProjects.length ? { projects: previous.addedProjects.map((name) => ({ name })) } : undefined,
    projects: added,
  });
  return added.map((p) => p.name);
}

async function replaceNotes(env: Env, userId: string, connector: Connector, suggestions: string[], previous?: Derived) {
  for (const id of previous?.noteIds ?? []) await forget(env, userId, id);
  const notes = [];
  for (const text of suggestions) notes.push(await remember(env, userId, { kind: "note", text: `${connector.name} idea: ${text}` }));
  return notes.map((n) => n.id);
}

/**
 * Reads the person's work from one service (that connector's read-only tools only), turns it into profile projects and a
 * few private improvement notes, and records what it added. Nothing raw from the service is kept, and nothing is shared.
 */
export async function importConnection(deps: AgentDeps, userId: string, connector: Connector): Promise<Derived> {
  const { env } = deps;
  const read = await readerFor(env, userId, connector);
  const { items, suggestions } = await connector.importItems(read, { deps, userId });
  const previous = (await getConnection(env, userId, connector.id))?.derived;
  const derived: Derived = {
    items,
    addedProjects: await writeProfile(env, userId, items, previous),
    noteIds: await replaceNotes(env, userId, connector, suggestions, previous),
    suggestions,
  };
  await saveDerived(env, userId, connector.id, derived);
  return derived;
}

/** Takes back out exactly what one provider's imports added: their profile projects and notes. Everything else stays. */
export async function removeImported(env: Env, userId: string, derived?: Derived) {
  if (!derived) return;
  if (derived.addedProjects.length) await updateProfile(env, userId, { remove: { projects: derived.addedProjects.map((name) => ({ name })) } });
  for (const id of derived.noteIds) await forget(env, userId, id);
}
