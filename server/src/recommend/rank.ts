import { LEVEL_ORDER, type Level } from "./types";

const MIN_WORD_LENGTH = 3;
const FILLER = new Set(["the", "and", "for", "with", "want", "dream", "would", "like", "work", "job", "role", "sure", "ready", "i'm"]);

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9'+#]+/)
    .filter((w) => w.length >= MIN_WORD_LENGTH && !FILLER.has(w));

// goals reorder items within a level and never move one across levels, so wanting a role can't inflate it
export function rankByGoals<T extends { title: string; level: Level }>(items: T[], goals: string[]): T[] {
  const wanted = new Set(goals.flatMap(words));
  const score = (item: T) => words(item.title).filter((w) => wanted.has(w)).length;
  return items
    .map((item, index) => ({ item, index, score: score(item), level: LEVEL_ORDER.indexOf(item.level) }))
    .sort((a, b) => a.level - b.level || b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}
