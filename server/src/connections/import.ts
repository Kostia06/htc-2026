import type { AgentDeps } from "../agents/core/types";
import type { Env } from "../env";
import { executeReadTool } from "../integrations/composio";
import { forget, remember } from "../memory/private/store";
import { getProfile, updateProfile } from "../memory/profile/store";
import type { ProfileSkill } from "../memory/profile/types";
import { composioUserId } from "./identity";
import { getConnection, saveDerived, type Derived } from "./store";
import type { Connector, Reader, WorkItem } from "./types";

export class NotConnected extends Error {}

const MAX_IMPORTED_SKILLS = 8;

async function readerFor(env: Env, userId: string, connector: Connector): Promise<Reader> {
  const connection = await getConnection(env, userId, connector.id);
  if (connection?.status !== "active") throw new NotConnected(`${connector.name} isn't connected`);
  const composioUser = await composioUserId(env, userId);
  return (slug, args) => executeReadTool(env, connector, slug, { userId: composioUser, accountId: connection.accountId, args });
}

// The person's reader when that service is connected, otherwise null: callers that can manage without it fall back.
export async function readerIfConnected(env: Env, userId: string, connector: Connector): Promise<Reader | null> {
  return readerFor(env, userId, connector).catch(() => null);
}

// projects the person already had (typed in, from their resume, or from another connector) are not this import's: it never
// overwrites or removes them, so disconnecting one service can't take away what another one, or the person, added
// skills follow the same rule: a language the person already lists keeps their own source and evidence
async function writeProfile(env: Env, userId: string, connector: Connector, items: WorkItem[], previous?: Derived) {
  const ourProjects = new Set((previous?.addedProjects ?? []).map((n) => n.toLowerCase()));
  const ourSkills = new Set((previous?.addedSkills ?? []).map((n) => n.toLowerCase()));
  const profile = await getProfile(env, userId);
  const theirProjects = new Set(profile.projects.map((p) => p.name.toLowerCase()).filter((n) => !ourProjects.has(n)));
  const theirSkills = new Set(profile.skills.map((s) => s.name.toLowerCase()).filter((n) => !ourSkills.has(n)));
  const added = items.filter((item) => !theirProjects.has(item.name.toLowerCase())).map(({ name, summary }) => ({ name, summary }));
  const skills = languageSkills(items, connector).filter((s) => !theirSkills.has(s.name.toLowerCase()));
  const remove = {
    ...(previous?.addedProjects.length ? { projects: previous.addedProjects.map((name) => ({ name })) } : {}),
    ...(previous?.addedSkills?.length ? { skills: previous.addedSkills } : {}),
  };
  await updateProfile(env, userId, { remove: Object.keys(remove).length ? remove : undefined, projects: added, skills });
  return { projects: added.map((p) => p.name), skills: skills.map((s) => s.name) };
}

// a repo's main language is a fact the service reports, so it is the one skill an import can state without a model's say-so;
// topics are left out: "hackathon" or "dotfiles" are labels, not skills
function languageSkills(items: WorkItem[], connector: Connector): ProfileSkill[] {
  const byName = new Map<string, ProfileSkill>();
  for (const item of items) {
    if (!item.language || byName.has(item.language.toLowerCase())) continue;
    byName.set(item.language.toLowerCase(), { name: item.language, source: "self-reported", evidence: `Main language of ${item.name} on ${connector.name}` });
  }
  return [...byName.values()].slice(0, MAX_IMPORTED_SKILLS);
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
  const added = await writeProfile(env, userId, connector, items, previous);
  const derived: Derived = {
    items,
    addedProjects: added.projects,
    addedSkills: added.skills,
    noteIds: await replaceNotes(env, userId, connector, suggestions, previous),
    suggestions,
  };
  await saveDerived(env, userId, connector.id, derived);
  return derived;
}

/** Takes back out exactly what one provider's imports added: their profile projects, skills and notes. Everything else stays. */
export async function removeImported(env: Env, userId: string, derived?: Derived) {
  if (!derived) return;
  const projects = derived.addedProjects.map((name) => ({ name }));
  const skills = derived.addedSkills ?? [];
  if (projects.length || skills.length) await updateProfile(env, userId, { remove: { projects, skills } });
  for (const id of derived.noteIds) await forget(env, userId, id);
}
