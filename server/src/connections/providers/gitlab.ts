import { firstArray, isFields, isoDate, safeName, summaryFrom, textOf } from "../text";
import type { Connector, WorkItem } from "../types";
import { LISTED, REPO_NAME, repoSuggestions, TOPIC, topItems } from "./code-repos";

// GitLab's /projects list. Kept: name, description, topics, stars, last activity. Never the owner, links, tokens or ids.
function projectFrom(raw: unknown): WorkItem | undefined {
  if (!isFields(raw)) return undefined;
  // only the person's own public, active work; a fork is someone else's project
  if (raw.visibility !== "public" || raw.archived === true || raw.forked_from_project) return undefined;
  const name = safeName(textOf(raw.name, REPO_NAME));
  if (!name) return undefined;
  const topicsRaw = Array.isArray(raw.topics) ? raw.topics : Array.isArray(raw.tag_list) ? raw.tag_list : [];
  return {
    name,
    summary: summaryFrom(raw.description),
    topics: topicsRaw.filter((t): t is string => typeof t === "string" && TOPIC.test(t)).slice(0, 10),
    stars: typeof raw.star_count === "number" && raw.star_count >= 0 ? Math.floor(raw.star_count) : 0,
    updatedAt: isoDate(raw.last_activity_at),
  };
}

export const gitlab: Connector = {
  id: "gitlab",
  name: "GitLab",
  category: "code",
  toolkit: "gitlab",
  toolkitVersion: "20261101_00",
  reads: "Reads your public projects. Never posts.",
  readTools: ["GITLAB_GET_PROJECTS"],
  async importItems(read) {
    const data = await read("GITLAB_GET_PROJECTS", { owned: true, visibility: "public", archived: false, order_by: "last_activity_at", per_page: LISTED, simple: false });
    const items = topItems(
      firstArray(data)
        .map(projectFrom)
        .filter((p): p is WorkItem => p !== undefined),
    );
    return { items, suggestions: repoSuggestions(items, "GitLab") };
  },
};
