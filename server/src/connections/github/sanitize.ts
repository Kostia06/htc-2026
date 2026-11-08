import { cleanText, firstArray, isFields, isoDate, redactSecrets, textOf } from "../text";

export { redactSecrets };

// What we keep from a GitHub repo: an allowlist, so a field GitHub or Composio adds later (a token, an email, a URL
// with credentials in it) is dropped without anyone having to notice it first. owner is only ever used to ask for
// the README; it is never stored, shown or given to a model.
export type RepoFacts = {
  name: string;
  owner: string;
  description?: string;
  language?: string;
  topics: string[];
  stars: number;
  updatedAt?: string;
};

export const MAX_README_CHARS = 4000;
const MAX_DESCRIPTION = 300;
const MAX_TOPICS = 10;
const REPO_NAME = /^[\w.-]{1,100}$/;
const TOPIC = /^[a-z0-9][a-z0-9-]{0,49}$/;
const LANGUAGE = /^[\w #+.-]{1,40}$/;

function repoFrom(raw: unknown): RepoFacts | undefined {
  if (!isFields(raw)) return undefined;
  // only the person's own public, active work: a fork is someone else's project, a private repo stays private
  if (raw.fork === true || raw.archived === true || raw.private !== false) return undefined;
  const name = textOf(raw.name, REPO_NAME);
  const owner = isFields(raw.owner) ? textOf(raw.owner.login, REPO_NAME) : undefined;
  if (!name || !owner) return undefined;
  const description = textOf(raw.description) ? cleanText(raw.description as string).slice(0, MAX_DESCRIPTION) : undefined;
  const topics = Array.isArray(raw.topics) ? raw.topics.filter((t): t is string => typeof t === "string" && TOPIC.test(t)).slice(0, MAX_TOPICS) : [];
  const stars = typeof raw.stargazers_count === "number" && raw.stargazers_count >= 0 ? Math.floor(raw.stargazers_count) : 0;
  return {
    name,
    owner,
    description: description || undefined,
    language: textOf(raw.language, LANGUAGE),
    topics,
    stars,
    updatedAt: isoDate(raw.pushed_at) ?? isoDate(raw.updated_at),
  };
}

export function reposFrom(data: unknown): RepoFacts[] {
  return firstArray(data).map(repoFrom).filter((r): r is RepoFacts => r !== undefined);
}

function decodeBase64(content: string) {
  try {
    const bytes = Uint8Array.from(atob(content.replace(/\s/g, "")), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function readmeContent(value: unknown, depth = 0): string {
  if (!isFields(value) || depth > 3) return "";
  for (const key of ["decoded_content", "text"]) if (typeof value[key] === "string") return value[key] as string;
  if (typeof value.content === "string") return value.encoding === "base64" ? decodeBase64(value.content) : value.content;
  for (const child of Object.values(value)) {
    const found = readmeContent(child, depth + 1);
    if (found) return found;
  }
  return "";
}

/** The README as plain, cleaned text, cut to a length a one-line summary needs. */
export function readmeFrom(data: unknown): string {
  const markdown = readmeContent(data)
    .slice(0, MAX_README_CHARS * 3)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ");
  return cleanText(markdown).slice(0, MAX_README_CHARS);
}

/** The repos most worth showing: most stars first, then most recently worked on. */
export function topRepos(repos: RepoFacts[], limit: number) {
  return [...repos].sort((a, b) => b.stars - a.stars || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, limit);
}
