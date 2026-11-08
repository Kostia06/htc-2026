import { firstArray, isFields, isoDate, safeName, summaryFrom } from "../text";
import type { Connector, WorkItem } from "../types";
import { LISTED, TOPIC, TOP_ITEMS } from "./code-repos";

// Dribbble's own shots. Kept: title, description (as plain text), tags, publish date. Never image or page links, or the user.
function shotFrom(raw: unknown): WorkItem | undefined {
  if (!isFields(raw)) return undefined;
  const name = safeName(raw.title);
  if (!name) return undefined;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string" && TOPIC.test(t)).slice(0, 10) : [];
  // the text representation is asked for, but strip tags anyway in case HTML comes back
  const description = typeof raw.description === "string" ? raw.description.replace(/<[^>]+>/g, " ") : undefined;
  return { name, summary: summaryFrom(description), kind: "Shot", topics: tags, updatedAt: isoDate(raw.published_at) };
}

function shotSuggestions(items: WorkItem[]): string[] {
  const out: string[] = [];
  for (const shot of items) {
    if (!shot.summary) out.push(`Add a short write-up to "${shot.name}" on Dribbble: the problem, your role and what you'd change.`);
    else if (shot.topics.length === 0) out.push(`Tag "${shot.name}" on Dribbble with the kind of work it is (like mobile or branding).`);
  }
  if (items.length > 0 && items.length < 3) out.push("Post one or two more shots so your Dribbble shows a range of work, not a single piece.");
  return out.slice(0, 3);
}

export const dribbble: Connector = {
  id: "dribbble",
  name: "Dribbble",
  category: "design",
  toolkit: "dribbble",
  toolkitVersion: "20261101_00",
  reads: "Reads your published shots. Never posts.",
  readTools: ["DRIBBBLE_LIST_MY_SHOTS"],
  async importItems(read) {
    const data = await read("DRIBBBLE_LIST_MY_SHOTS", { per_page: LISTED, description_media_type: "application/vnd.dribbble.v2.text+json" });
    const items = firstArray(data)
      .map(shotFrom)
      .filter((s): s is WorkItem => s !== undefined)
      .slice(0, TOP_ITEMS);
    return { items, suggestions: shotSuggestions(items) };
  },
};
