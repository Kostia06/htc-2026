import type { WorkItem } from "../types";

export const TOP_ITEMS = 5;
export const LISTED = 30;
export const REPO_NAME = /^[\w. -]{1,100}$/;
export const TOPIC = /^[a-z0-9][a-z0-9 -]{0,49}$/i;
export const LANGUAGE = /^[\w #+.-]{1,40}$/;

/** Most stars first, then most recently worked on. */
export function topItems(items: WorkItem[], limit = TOP_ITEMS) {
  return [...items].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, limit);
}

/** Plain, checkable fixes for a code host's repos, worked out from what's missing rather than asked of a model. */
export function repoSuggestions(items: WorkItem[], service: string, { topics = true } = {}): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (!item.summary) out.push(`Add a one-line description to ${item.name} on ${service} that says what it does.`);
    else if (topics && item.topics.length === 0) out.push(`Add a few topics to ${item.name} on ${service} (its language and what it's for) so it's easier to find.`);
  }
  return out.slice(0, 3);
}
