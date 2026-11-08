import type { RepoFacts } from "./sanitize";

// what the summarising model is shown about one repo: only cleaned text, never the owner or anything credential-shaped
export type RepoForModel = Pick<RepoFacts, "name" | "description" | "language" | "topics"> & { readme: string };
export type ProjectSummary = { name: string; summary?: string };

const MAX_SUMMARY = 160;
const HYPE = /\b(perfect|ideal|guaranteed|definitely|world[- ]class|revolutionary|cutting[- ]edge|best[- ]in[- ]class)\b/i;

const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const numbersIn = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
const sourceOf = (repo: RepoForModel) => `${repo.description ?? ""}\n${repo.readme}`;

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);

// a summary stands only if its evidence is a real quote from the repo and it adds no number the repo doesn't state
function groundedSummary(repo: RepoForModel, raw: Fields): string | undefined {
  const summary = typeof raw.summary === "string" ? raw.summary.trim().replace(/\s+/g, " ") : "";
  const evidence = typeof raw.evidence === "string" ? normalize(raw.evidence) : "";
  const source = normalize(sourceOf(repo));
  if (!summary || summary.length > MAX_SUMMARY || HYPE.test(summary)) return undefined;
  if (evidence.length < 8 || !source.includes(evidence)) return undefined;
  const stated = new Set(numbersIn(sourceOf(repo)));
  if (numbersIn(summary).some((n) => !stated.has(n))) return undefined;
  return summary;
}

/** One project per repo, in the repos' order. A summary the repo can't back falls back to its own description, or none. */
export function groundProjects(repos: RepoForModel[], output: unknown): { projects: ProjectSummary[]; dropped: number } {
  const proposed = new Map<string, Fields>();
  const list = isFields(output) && Array.isArray(output.projects) ? output.projects : [];
  for (const item of list) if (isFields(item) && typeof item.name === "string") proposed.set(item.name.toLowerCase(), item);
  let dropped = 0;
  const projects = repos.map((repo) => {
    const raw = proposed.get(repo.name.toLowerCase());
    const summary = raw ? groundedSummary(repo, raw) : undefined;
    if (raw && !summary) dropped++;
    const fallback = repo.description?.slice(0, MAX_SUMMARY);
    return { name: repo.name, summary: summary ?? fallback };
  });
  return { projects, dropped };
}

/** Plain, checkable fixes for the person's own repos, worked out from what's missing rather than asked of a model. */
export function improvementSuggestions(repos: RepoForModel[], limit = 3): string[] {
  const suggestions: string[] = [];
  for (const repo of repos) {
    if (!repo.readme) suggestions.push(`Add a README to ${repo.name} that says what it does and how to run it.`);
    else if (!repo.description) suggestions.push(`Add a one-line description to ${repo.name} so it reads well on your GitHub profile.`);
    else if (repo.topics.length === 0) suggestions.push(`Add a few topics to ${repo.name} (like its language and what it's for) so it's easier to find.`);
  }
  return suggestions.slice(0, limit);
}
