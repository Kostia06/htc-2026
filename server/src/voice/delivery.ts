import { type Habits, measureHabits } from "./habits";

// habits are optional because turns stored before they were measured don't have them
export type Delivery = { words: number; fillerWords: number; wordsPerMinute: number | null } & Partial<Habits>;

const FILLERS = /\b(um+|uh+|erm|like|you know)\b/gi;

// counted in code from the transcript the client sends: instant, free, and the same on every platform
export function measureDelivery(answer: string, durationMs: number): Delivery {
  const words = answer.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  const fillerWords = answer.match(FILLERS)?.length ?? 0;
  const wordsPerMinute = words > 0 && durationMs > 0 ? Math.round(words / (durationMs / 60_000)) : null;
  return { words, fillerWords, wordsPerMinute, ...measureHabits(answer) };
}
