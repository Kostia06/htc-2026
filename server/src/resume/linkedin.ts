import { anonymize } from "../lib/anonymize";

export const LINKEDIN_AREAS = ["headline", "about", "skills", "experience"] as const;
export type LinkedinArea = (typeof LINKEDIN_AREAS)[number];

// quote is copied from the person's own PDF, so they can find the line the suggestion is about
export type LinkedinSuggestion = { area: LinkedinArea; quote: string; suggestion: string; why: string };

const MAX_SUGGESTIONS = 10;
const MAX_TEXT = 400;
const MIN_QUOTE = 4;
const HYPE = /\b(perfect fit|ideal candidate|guaranteed|definitely|rockstar|ninja|world[- ]class)\b/i;
// LinkedIn's PDF prints links without a scheme ("www.linkedin.com/in/x"), so bare domains go too
const LINK = /\b(https?:\/\/|www\.)[^\s)>\]]+/gi;
// lower case only, so "ASP.NET" or "Node.JS" in a skills list survive
const BARE_DOMAIN = /\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|ca|dev|io|org|net|me|app|co)(\/[^\s)>\]]*)?/g;

/** The PDF's text with contact details and links gone: only this ever reaches the reviewing model. */
export function maskLinkedinText(text: string) {
  return anonymize(text)
    .replace(LINK, "[link]")
    .replace(BARE_DOMAIN, "[link]")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const clean = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_TEXT) : "");

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);

function grounded(source: string, raw: unknown): LinkedinSuggestion | undefined {
  if (!isFields(raw)) return undefined;
  const area = LINKEDIN_AREAS.find((a) => a === raw.area);
  const quote = clean(raw.quote);
  const suggestion = clean(raw.suggestion);
  const why = clean(raw.why);
  if (!area || !suggestion || quote.length < MIN_QUOTE || HYPE.test(suggestion)) return undefined;
  if (!source.includes(normalize(quote))) return undefined;
  // a suggestion that would put contact details back is not about the profile's wording
  if (anonymize(suggestion) !== suggestion) return undefined;
  return { area, quote, suggestion, why };
}

/** Keeps only suggestions whose quote really is in the PDF, so every one points at something the person wrote. */
export function groundLinkedinSuggestions(text: string, output: unknown): { suggestions: LinkedinSuggestion[]; dropped: number } {
  const proposed = isFields(output) && Array.isArray(output.suggestions) ? output.suggestions : [];
  const source = normalize(text);
  const suggestions = proposed.map((raw) => grounded(source, raw)).filter((s): s is LinkedinSuggestion => s !== undefined);
  return { suggestions: suggestions.slice(0, MAX_SUGGESTIONS), dropped: proposed.length - suggestions.length };
}
