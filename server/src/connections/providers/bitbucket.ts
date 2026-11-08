import { firstArray, isFields, isoDate, safeName, summaryFrom, textOf } from "../text";
import type { Connector, WorkItem } from "../types";
import { LANGUAGE, LISTED, REPO_NAME, repoSuggestions, topItems } from "./code-repos";

// Bitbucket's /repositories list. Kept: name, description, language, last update. Never the owner, clone links or ids.
function repoFrom(raw: unknown): WorkItem | undefined {
  if (!isFields(raw)) return undefined;
  // a private repo stays private and a fork (it has a parent) is someone else's project
  if (raw.is_private !== false || raw.parent) return undefined;
  const name = safeName(textOf(raw.name, REPO_NAME));
  if (!name) return undefined;
  const language = textOf(raw.language, LANGUAGE);
  return {
    name,
    summary: summaryFrom(raw.description),
    language: language ? language[0].toUpperCase() + language.slice(1) : undefined,
    topics: [],
    updatedAt: isoDate(raw.updated_on),
  };
}

export const bitbucket: Connector = {
  id: "bitbucket",
  name: "Bitbucket",
  category: "code",
  toolkit: "bitbucket",
  toolkitVersion: "20261101_00",
  reads: "Reads your public repos. Never posts.",
  readTools: ["BITBUCKET_LIST_REPOSITORIES"],
  async importItems(read) {
    const data = await read("BITBUCKET_LIST_REPOSITORIES", { role: "owner", sort: "-updated_on", pagelen: LISTED });
    const items = topItems(
      firstArray(data)
        .map(repoFrom)
        .filter((r): r is WorkItem => r !== undefined),
    );
    // Bitbucket has no topics, so the only gap worth naming is a missing description
    return { items, suggestions: repoSuggestions(items, "Bitbucket", { topics: false }) };
  },
};
