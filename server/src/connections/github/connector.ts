import type { AgentDeps } from "../../agents/core/types";
import { orchestrate } from "../../agents/orchestrator";
import { ComposioError } from "../../integrations/composio";
import type { Connector, Reader, WorkItem } from "../types";
import { groundProjects, improvementSuggestions, type ProjectSummary, type RepoForModel } from "./ground";
import { READ_ONLY_GITHUB_TOOLS } from "./read-only";
import { readmeFrom, reposFrom, topRepos, type RepoFacts } from "./sanitize";

const TOP_REPOS = 5;
const LISTED = 30;

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

/**
 * The person's top public repos, with one-line summaries a model words from each repo's own README (wrapped as untrusted,
 * then checked against the repo's text in code). The only connector that asks a model anything.
 */
export const github: Connector = {
  id: "github",
  name: "GitHub",
  category: "code",
  toolkit: "github",
  toolkitVersion: "20261103_00",
  reads: "Reads your public repos. Never posts.",
  readTools: READ_ONLY_GITHUB_TOOLS,
  async importItems(read, { deps, userId }) {
    const listed = reposFrom(await read("GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", { type: "owner", sort: "pushed", per_page: LISTED }));
    const top = topRepos(listed, TOP_REPOS);
    const forModel: RepoForModel[] = await Promise.all(
      top.map(async (repo) => ({ name: repo.name, description: repo.description, language: repo.language, topics: repo.topics, readme: await readmeOf(read, repo) })),
    );
    const projects = await summarise(deps, userId, forModel);
    const items = top.map(
      (repo, i): WorkItem => ({ name: repo.name, summary: projects[i]?.summary, language: repo.language, topics: repo.topics, stars: repo.stars, updatedAt: repo.updatedAt }),
    );
    return { items, suggestions: improvementSuggestions(forModel) };
  },
};
