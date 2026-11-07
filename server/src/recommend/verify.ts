import type { Requirement } from "./types";

const MIN_QUOTE_LENGTH = 2;

const BANNED_PHRASES = [
  /perfect fit/gi,
  /ideal candidate/gi,
  /\bguaranteed\b/gi,
  /\byou will get\b/gi,
  /\byou'll get\b/gi,
  /\bdefinitely\b/gi,
  /\b\d+(?:\.\d+)?\s*%\s*(?:fit|match|chance)\w*/gi,
  /\b(?:fit|match|chance)\w*\s+(?:of\s+)?\d+(?:\.\d+)?\s*%/gi,
];

function normalize(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// whole words only at the edges, so "Go" doesn't match inside "good"
export function containsQuote(text: string, quote: string) {
  const needle = normalize(quote);
  if (needle.length < MIN_QUOTE_LENGTH) return false;
  const start = /^[a-z0-9]/.test(needle) ? "(?<![a-z0-9])" : "";
  const end = /[a-z0-9]$/.test(needle) ? "(?![a-z0-9])" : "";
  return new RegExp(`${start}${escapeRegExp(needle)}${end}`).test(normalize(text));
}

// a requirement must be quoted from the page; a "yes" must be backed by a quote from the profile
export function verifyRequirements(draft: Requirement[], texts: { source: string; profile: string }) {
  const requirements: Requirement[] = [];
  const dropped: string[] = [];
  for (const { quote, kind, met, evidence } of draft) {
    if (!containsQuote(texts.source, quote)) {
      dropped.push(quote);
      continue;
    }
    const proven = evidence !== undefined && containsQuote(texts.profile, evidence);
    if (proven) requirements.push({ quote, kind, met, evidence });
    else requirements.push({ quote, kind, met: met === "yes" ? "unknown" : met });
  }
  return { requirements, dropped };
}

export function bannedPhrasesIn(text: string) {
  const found = BANNED_PHRASES.flatMap((pattern) => [...text.matchAll(pattern)]);
  return found.sort((a, b) => a.index - b.index).map((m) => m[0].toLowerCase());
}

export function withoutBannedPhrases(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => bannedPhrasesIn(sentence).length === 0)
    .join(" ")
    .trim();
}
