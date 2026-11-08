import type { AgentDeps } from "../../agents/core/types";
import { orchestrate } from "../../agents/orchestrator";
import type { Env } from "../../env";
import { ComposioError, executeReadTool } from "../../integrations/composio";
import { forget, remember } from "../../memory/private/store";
import { getProfile, updateProfile } from "../../memory/profile/store";
import { getConnection, saveDerived, type GithubDerived, type RepoSummary } from "../store";
import { composioUserId } from "./identity";
import { groundProjects, improvementSuggestions, type ProjectSummary, type RepoForModel } from "./ground";
import { readmeFrom, reposFrom, topRepos, type RepoFacts } from "./sanitize";

const TOP_REPOS = 5;
const LISTED = 30;

export class NotConnected extends Error {}

type Reader = (slug: string, args: Record<string, unknown>) => Promise<unknown>;

async function readerFor(env: Env, userId: string): Promise<Reader> {
  const connection = await getConnection(env, userId, "github");
  if (connection?.status !== "active") throw new NotConnected("GitHub isn't connected");
  const composioUser = await composioUserId(env, userId);
  return (slug, args) => executeReadTool(env, slug, { userId: composioUser, accountId: connection.accountId, args });
}

// a repo without a README is normal, not a failure: GitHub answers 404 and the import carries on
async function readmeOf(read: Reader, repo: RepoFacts) {
  try {
    return readmeFrom(await read("GITHUB_GET_A_REPOSITORY_README", { owner: repo.owner, repo: repo.name }));
  } catch (e) {
    if (e instanceof ComposioError) return "";
    throw e;
  }
}

// the model only words the summaries; if it fails, each repo keeps its own description
async function summarise(deps: AgentDeps, userId: string, repos: RepoForModel[]): Promise<ProjectSummary[]> {
  const withText = repos.filter((r) => r.description || r.readme);
  const fallback = groundProjects(repos, null).projects;
  if (withText.length === 0) return fallback;
  const run = await orchestrate(deps, { skillId: "github-projects", platform: "background", userId, input: { repos: withText } }).catch(() => null);
  if (run?.status !== "done") return fallback;
  const byName = new Map((run.output.projects as ProjectSummary[] | undefined)?.map((p) => [p.name.toLowerCase(), p]) ?? []);
  return repos.map((r) => byName.get(r.name.toLowerCase()) ?? { name: r.name, summary: r.description });
}

// projects the person already had (typed in, or from their resume) are theirs: the import never overwrites or removes them
async function writeProfile(env: Env, userId: string, projects: ProjectSummary[], previous?: GithubDerived) {
  const ours = new Set((previous?.addedProjects ?? []).map((n) => n.toLowerCase()));
  const profile = await getProfile(env, userId);
  const theirs = new Set(profile.projects.map((p) => p.name.toLowerCase()).filter((n) => !ours.has(n)));
  const added = projects.filter((p) => !theirs.has(p.name.toLowerCase()));
  await updateProfile(env, userId, {
    remove: previous?.addedProjects.length ? { projects: previous.addedProjects.map((name) => ({ name })) } : undefined,
    projects: added,
  });
  return added.map((p) => p.name);
}

async function replaceNotes(env: Env, userId: string, suggestions: string[], previous?: GithubDerived) {
  for (const id of previous?.noteIds ?? []) await forget(env, userId, id);
  const notes = [];
  for (const text of suggestions) notes.push(await remember(env, userId, { kind: "note", text: `GitHub idea: ${text}` }));
  return notes.map((n) => n.id);
}

/**
 * Reads the person's top public repos (read-only tools only), turns them into profile projects grounded in each repo's own
 * text and a few private improvement notes, and records what it added. Nothing raw from GitHub is kept.
 */
export async function importGithub(deps: AgentDeps, userId: string): Promise<GithubDerived> {
  const { env } = deps;
  const read = await readerFor(env, userId);
  const listed = reposFrom(await read("GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", { type: "owner", sort: "pushed", per_page: LISTED }));
  const top = topRepos(listed, TOP_REPOS);
  const forModel: RepoForModel[] = await Promise.all(
    top.map(async (repo) => ({ name: repo.name, description: repo.description, language: repo.language, topics: repo.topics, readme: await readmeOf(read, repo) })),
  );

  const projects = await summarise(deps, userId, forModel);
  const previous = (await getConnection(env, userId, "github"))?.derived;
  const suggestions = improvementSuggestions(forModel);
  const derived: GithubDerived = {
    repos: top.map((repo, i): RepoSummary => ({
      name: repo.name,
      summary: projects[i]?.summary,
      language: repo.language,
      topics: repo.topics,
      stars: repo.stars,
      updatedAt: repo.updatedAt,
    })),
    addedProjects: await writeProfile(env, userId, projects, previous),
    noteIds: await replaceNotes(env, userId, suggestions, previous),
    suggestions,
  };
  await saveDerived(env, userId, derived);
  return derived;
}

/** Takes back out exactly what imports added: their profile projects and notes. The person's own entries stay. */
export async function removeImported(env: Env, userId: string, derived?: GithubDerived) {
  if (!derived) return;
  if (derived.addedProjects.length) await updateProfile(env, userId, { remove: { projects: derived.addedProjects.map((name) => ({ name })) } });
  for (const id of derived.noteIds) await forget(env, userId, id);
}
