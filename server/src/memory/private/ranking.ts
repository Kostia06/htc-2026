const DAY_MS = 86_400_000;
const STOP_WORDS = new Set(["the", "and", "for", "with", "that", "this", "you", "are", "was", "but", "not", "have", "has", "from"]);

function keywords(text: string) {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return new Set(words.filter((word) => word.length >= 3 && !STOP_WORDS.has(word)));
}

// overlap is a whole number and recency stays below 1, so recency only breaks ties between equally relevant memories
export function relevance(text: string, lastUsedAt: string, query: string | undefined, now: Date) {
  const ageDays = Math.max(0, (now.getTime() - Date.parse(lastUsedAt)) / DAY_MS);
  const recency = 1 / (1 + ageDays);
  if (!query) return recency;

  const wanted = keywords(query);
  const overlap = [...keywords(text)].filter((word) => wanted.has(word)).length;
  return overlap + recency;
}
