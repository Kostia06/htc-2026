import { firstArray, isFields, isoDate, monthYear, safeName, textOf } from "../text";
import type { Connector, WorkItem } from "../types";
import { TOP_ITEMS } from "./code-repos";

// Names and types of files the person owns. Contents are never read, and only these kinds count as work worth showing.
const KINDS: Record<string, { kind: string; label: string }> = {
  "application/vnd.google-apps.document": { kind: "Doc", label: "Google Doc" },
  "application/vnd.google-apps.presentation": { kind: "Slides", label: "Google Slides deck" },
  "application/vnd.google-apps.spreadsheet": { kind: "Sheet", label: "Google Sheet" },
  "application/pdf": { kind: "PDF", label: "PDF" },
};
const FIELDS = "files(name,mimeType,modifiedTime,trashed)";
// owned by the person, not in the trash, and one of the kinds above: shared-with-me files are other people's work
const QUERY = `'me' in owners and trashed = false and (${Object.keys(KINDS)
  .map((type) => `mimeType = '${type}'`)
  .join(" or ")})`;
const UNTITLED = /^(untitled|copy of|new document|document|presentation|spreadsheet)\b/i;

type DriveFile = WorkItem & { untitled: boolean };

function fileFrom(raw: unknown): DriveFile | undefined {
  if (!isFields(raw) || raw.trashed === true) return undefined;
  const type = KINDS[textOf(raw.mimeType) ?? ""];
  const name = safeName(raw.name);
  if (!type || !name) return undefined;
  const updatedAt = isoDate(raw.modifiedTime);
  const summary = updatedAt ? `${type.label}, last edited ${monthYear(updatedAt)}` : type.label;
  return { name, summary, kind: type.kind, topics: [], updatedAt, untitled: UNTITLED.test(name) };
}

function fileSuggestions(files: DriveFile[]): string[] {
  const out = files.filter((f) => f.untitled).map((f) => `Rename "${f.name}" in Google Drive to say what it is, so it reads as a work sample.`);
  const best = files.find((f) => !f.untitled && f.kind !== "PDF");
  if (best) out.push(`Export "${best.name}" as a PDF and link it from your resume as a work sample.`);
  return out.slice(0, 3);
}

export const googledrive: Connector = {
  id: "googledrive",
  name: "Google Drive",
  category: "documents",
  toolkit: "googledrive",
  toolkitVersion: "20261101_00",
  reads: "Reads the names of your docs, decks and sheets, not what's in them.",
  readTools: ["GOOGLEDRIVE_LIST_FILES"],
  async importItems(read) {
    const data = await read("GOOGLEDRIVE_LIST_FILES", { q: QUERY, orderBy: "modifiedTime desc", pageSize: 30, fields: FIELDS, spaces: "drive" });
    const files = firstArray(data)
      .map(fileFrom)
      .filter((f): f is DriveFile => f !== undefined);
    // an untitled file says nothing about the work: it only earns a rename tip
    const items = files
      .filter((f) => !f.untitled)
      .slice(0, TOP_ITEMS)
      .map(({ untitled: _untitled, ...item }) => item);
    return { items, suggestions: fileSuggestions(files) };
  },
};
