import { firstArray, isFields, isoDate, monthYear, safeName } from "../text";
import type { Connector, WorkItem } from "../types";
import { LISTED, TOP_ITEMS } from "./code-repos";

// Notion's search over the pages the person chose to share with Skillit during sign-in. Kept: the page title and when it
// was last edited, nothing else: no page body, no ids, no links, no authors or their emails.
function titleOf(properties: unknown): string | undefined {
  if (!isFields(properties)) return undefined;
  for (const property of Object.values(properties)) {
    if (!isFields(property) || property.type !== "title" || !Array.isArray(property.title)) continue;
    return property.title.map((part) => (isFields(part) && typeof part.plain_text === "string" ? part.plain_text : "")).join("");
  }
  return undefined;
}

function pageFrom(raw: unknown): WorkItem | undefined {
  if (!isFields(raw) || raw.object !== "page" || raw.archived === true || raw.in_trash === true) return undefined;
  const name = safeName(titleOf(raw.properties));
  if (!name) return undefined;
  const updatedAt = isoDate(raw.last_edited_time);
  return { name, summary: updatedAt ? `Notion page, last edited ${monthYear(updatedAt)}` : "Notion page", kind: "Page", topics: [], updatedAt };
}

function pageSuggestions(items: WorkItem[]): string[] {
  const out = items.slice(0, 2).map((page) => `Publish "${page.name}" as a public Notion page so you can link it from your resume.`);
  if (items.length > 0) out.push("Start each page you'd show an employer with two lines: what you made and what changed because of it.");
  return out.slice(0, 3);
}

export const notion: Connector = {
  id: "notion",
  name: "Notion",
  category: "writing",
  toolkit: "notion",
  toolkitVersion: "20261101_00",
  reads: "Reads the titles of pages you choose to share. Never edits.",
  readTools: ["NOTION_SEARCH_NOTION_PAGE"],
  async importItems(read) {
    const data = await read("NOTION_SEARCH_NOTION_PAGE", { filter_value: "page", page_size: LISTED, timestamp: "last_edited_time", direction: "descending" });
    const items = firstArray(data)
      .map(pageFrom)
      .filter((p): p is WorkItem => p !== undefined)
      .slice(0, TOP_ITEMS);
    return { items, suggestions: pageSuggestions(items) };
  },
};
