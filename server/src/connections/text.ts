import { anonymize } from "../lib/anonymize";

// Shared by every connector: text written by someone on another service is made safe to keep and to show a model.

const SECRETS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[redacted]"],
  [/\b(gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|glpat-[A-Za-z0-9_-]{16,})/g, "[redacted]"],
  [/\b(sk|pk|rk)[-_](live|test|proj|ant)?[-_]?[A-Za-z0-9_-]{16,}/g, "[redacted]"],
  [/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, "[redacted]"],
  [/\bAIza[0-9A-Za-z_-]{30,}/g, "[redacted]"],
  [/\bya29\.[0-9A-Za-z_-]{8,}/g, "[redacted]"],
  [/\b(secret|ntn)_[A-Za-z0-9]{16,}/g, "[redacted]"],
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

/** No secrets, no links, no contact details, tidy whitespace. */
export function cleanText(text: string) {
  return anonymize(redactSecrets(text).replace(URL, "[link]"))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// text that addresses a model rather than describing work: never imported, so it can't ride into a prompt via the profile
const INSTRUCTION =
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any)\b[^.\n]{0,20}\b(instructions?|rules|prompts?|messages?)\b|\bsystem prompt\b|\byou are (now )?(an? |the )?(ai|assistant|language model|chatbot)\b|<\/?\s*(system|assistant|untrusted-web-content)\b/i;

const looksLikeInstruction = (text: string) => INSTRUCTION.test(text);

export type Fields = Record<string, unknown>;
export const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
export const textOf = (value: unknown, pattern?: RegExp) => (typeof value === "string" && (!pattern || pattern.test(value)) ? value : undefined);

/** Composio wraps a service's list in an object whose key isn't documented; the first array found is the list. */
export function firstArray(value: unknown, depth = 0): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isFields(value) || depth > 3) return [];
  for (const child of Object.values(value)) {
    const found = firstArray(child, depth + 1);
    if (found.length) return found;
  }
  return [];
}

export function isoDate(value: unknown): string | undefined {
  const raw = textOf(value);
  return raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : undefined;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthYear = (iso: string) => `${MONTHS[new Date(iso).getUTCMonth()]} ${new Date(iso).getUTCFullYear()}`;

const MAX_SUMMARY = 160;
const MAX_NAME = 120;

/** A title worth keeping: cleaned, short, and not talking to a model. */
export function safeName(value: unknown): string | undefined {
  const raw = textOf(value);
  if (!raw) return undefined;
  const name = cleanText(raw).replace(/\s+/g, " ").slice(0, MAX_NAME).trim();
  return name && !looksLikeInstruction(name) ? name : undefined;
}

/** The first sentence of the item's own description, cleaned: a summary that can only say what the author said. */
export function summaryFrom(value: unknown): string | undefined {
  const raw = textOf(value);
  if (!raw) return undefined;
  const cleaned = cleanText(raw).replace(/\s+/g, " ");
  const sentence = cleaned.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? cleaned;
  const summary = sentence.slice(0, MAX_SUMMARY).trim();
  return summary && !looksLikeInstruction(summary) ? summary : undefined;
}
