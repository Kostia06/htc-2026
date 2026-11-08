import type { ResumeContact } from "./types";

// Contact details are read by code, never by a model: they stay out of every prompt (see lib/anonymize).
export type FoundContact = { name?: string; email?: string; phone?: string; links?: string[] };

const HEAD_LINES = 8;
const MAX_LINKS = 4;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const LINK = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[\w-]+|github\.com\/[\w-]+|gitlab\.com\/[\w-]+)\/?/gi;
// words that open a heading or a document title, not a person's name
const NOT_A_NAME = /\b(resume|curriculum|vitae|cv|transcript|official|university|college|school|certificate|summary|profile|experience|education|skills|contact|page)\b/i;
const NAME_WORD = /^[A-Z][a-zA-Z'’-]*\.?$/;

function nameFrom(line: string): string | undefined {
  const words = line.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4 || NOT_A_NAME.test(line)) return undefined;
  // all caps ("JORDAN LEE") is a common resume header; a lowercase word means a sentence
  return words.every((w) => NAME_WORD.test(w) || /^[A-Z'’-]{2,}$/.test(w)) ? words.join(" ") : undefined;
}

/** The person's name, email, phone and profile links, from the top of a resume or similar document. */
export function contactFromText(text: string): FoundContact {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const head = lines.slice(0, HEAD_LINES).join("\n");
  const found: FoundContact = {};
  const name = lines.slice(0, 3).map(nameFrom).find(Boolean);
  if (name) found.name = name;
  const email = EMAIL.exec(head)?.[0];
  if (email) found.email = email;
  const phone = PHONE.exec(head.replace(EMAIL, ""))?.[0];
  if (phone) found.phone = phone.trim();
  const links = [...new Set(head.match(LINK) ?? [])].map((l) => l.replace(/\/$/, "")).slice(0, MAX_LINKS);
  if (links.length) found.links = links;
  return found;
}

/** The contact with its blanks filled from what was found, or null when nothing new was found. What's typed always wins. */
export function fillContact(contact: ResumeContact, found: FoundContact): ResumeContact | null {
  const next: ResumeContact = {
    ...contact,
    name: contact.name.trim() || found.name || "",
    email: contact.email.trim() || found.email || "",
    phone: contact.phone.trim() || found.phone || "",
    links: contact.links.length || !found.links?.length ? contact.links : found.links,
  };
  const changed = next.name !== contact.name || next.email !== contact.email || next.phone !== contact.phone || next.links !== contact.links;
  return changed ? next : null;
}
