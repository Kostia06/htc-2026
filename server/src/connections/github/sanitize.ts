import { anonymize } from "../../lib/anonymize";

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

const SECRETS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[redacted]"],
  [/\b(gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})/g, "[redacted]"],
  [/\b(sk|pk|rk)[-_](live|test|proj|ant)?[-_]?[A-Za-z0-9_-]{16,}/g, "[redacted]"],
  [/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, "[redacted]"],
  [/\bAIza[0-9A-Za-z_-]{30,}/g, "[redacted]"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, "[redacted]"],
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, "[redacted]"],
  [/\bBearer\s+[\w.~+/-]{8,}=*/gi, "Bearer [redacted]"],
  // KEY=value, "token": "value", password: value ...
  [/\b([\w-]*(api[_-]?key|secret|token|password|passwd|pwd|credential|private[_-]?key|access[_-]?key)[\w-]*)(["']?\s*[:=]\s*)["']?[^\s"',;]+["']?/gi, "$1$3[redacted]"],
  // anything long and random-looking that survived the named patterns
  [/\b[A-Fa-f0-9]{32,}\b/g, "[redacted]"],
  [/\b(?=[A-Za-z0-9+/_-]*\d)(?=[A-Za-z0-9+/_-]*[A-Z])[A-Za-z0-9+/_-]{40,}={0,2}/g, "[redacted]"],
];

const URL = /\b(https?:\/\/|www\.)[^\s)>\]"']+/gi;

export function redactSecrets(text: string) {
  return SECRETS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

/** Text written by someone on GitHub, made safe to show a model: no secrets, no links, no contact details. */
export function cleanGithubText(text: string) {
  return anonymize(redactSecrets(text).replace(URL, "[link]"))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, pattern?: RegExp) => (typeof value === "string" && (!pattern || pattern.test(value)) ? value : undefined);

function repoFrom(raw: unknown): RepoFacts | undefined {
  if (!isFields(raw)) return undefined;
  // only the person's own public, active work: a fork is someone else's project, a private repo stays private
  if (raw.fork === true || raw.archived === true || raw.private !== false) return undefined;
  const name = text(raw.name, REPO_NAME);
  const owner = isFields(raw.owner) ? text(raw.owner.login, REPO_NAME) : undefined;
  if (!name || !owner) return undefined;
  const description = text(raw.description) ? cleanGithubText(raw.description as string).slice(0, MAX_DESCRIPTION) : undefined;
  const topics = Array.isArray(raw.topics) ? raw.topics.filter((t): t is string => typeof t === "string" && TOPIC.test(t)).slice(0, MAX_TOPICS) : [];
  const stars = typeof raw.stargazers_count === "number" && raw.stargazers_count >= 0 ? Math.floor(raw.stargazers_count) : 0;
  const updatedAt = text(raw.pushed_at) ?? text(raw.updated_at);
  return {
    name,
    owner,
    description: description || undefined,
    language: text(raw.language, LANGUAGE),
    topics,
    stars,
    updatedAt: updatedAt && !Number.isNaN(Date.parse(updatedAt)) ? new Date(updatedAt).toISOString() : undefined,
  };
}

// Composio wraps GitHub's array in an object whose key isn't documented; take the first array of objects found
function firstObjectArray(value: unknown, depth = 0): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isFields(value) || depth > 3) return [];
  for (const child of Object.values(value)) {
    const found = firstObjectArray(child, depth + 1);
    if (found.length) return found;
  }
  return [];
}

export function reposFrom(data: unknown): RepoFacts[] {
  return firstObjectArray(data).map(repoFrom).filter((r): r is RepoFacts => r !== undefined);
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
  return cleanGithubText(markdown).slice(0, MAX_README_CHARS);
}

/** The repos most worth showing: most stars first, then most recently worked on. */
export function topRepos(repos: RepoFacts[], limit: number) {
  return [...repos].sort((a, b) => b.stars - a.stars || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, limit);
}
