import type { Env } from "../env";

// the embedding model takes up to 100 texts per call
const MAX_TEXTS = 100;
// bge-base puts loosely related career lines around 0.6; above this they are about the same thing
export const LINK_THRESHOLD = 0.72;
// without embeddings, two shared meaningful words are the weakest link worth drawing
const MIN_SHARED_WORDS = 2;

export type Linkable = { id: string; text: string };
export type Link = { you: string; everyone: string; score: number };

async function embedTexts(env: Env, texts: string[]): Promise<number[][]> {
  const out = (await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: texts })) as { data: number[][] };
  return out.data;
}

// swapped out in tests: Workers AI only exists remotely
export const deps = { embedTexts };

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const STOP = new Set(["the", "and", "for", "with", "that", "this", "you", "your", "are", "was", "but", "not", "have", "has", "from", "into", "what", "when", "how", "they", "them", "about", "more", "most", "one", "get", "got"]);
const words = (text: string) => new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w)));

function keywordScore(a: string, b: string) {
  const left = words(a);
  const shared = [...words(b)].filter((w) => left.has(w)).length;
  // a one-word item such as a skill name links on that word alone
  const needed = Math.min(MIN_SHARED_WORDS, left.size);
  return needed > 0 && shared >= needed ? Math.min(0.99, 0.65 + shared * 0.1) : 0;
}

async function scoreMatrix(env: Env, you: Linkable[], everyone: Linkable[]): Promise<number[][]> {
  const texts = [...you, ...everyone].map((item) => item.text);
  try {
    const chunks = Array.from({ length: Math.ceil(texts.length / MAX_TEXTS) }, (_, i) => texts.slice(i * MAX_TEXTS, (i + 1) * MAX_TEXTS));
    const vectors = (await Promise.all(chunks.map((chunk) => deps.embedTexts(env, chunk)))).flat();
    return you.map((_, i) => everyone.map((_, j) => cosine(vectors[i], vectors[you.length + j])));
  } catch (e) {
    // an unreachable model must not blank the screen: shared words still draw the obvious links
    console.error("crossroads embedding failed", (e as Error).message);
    return you.map((a) => everyone.map((b) => keywordScore(a.text, b.text)));
  }
}

/**
 * Which of the person's items and the road's lines are about the same thing. The person's text is embedded for this
 * request only and never stored: private memories must not reach the shared vector index.
 * Each of their items keeps its strongest links, at most `perItem`, strongest first overall.
 */
export async function linkItems(env: Env, you: Linkable[], everyone: Linkable[], perItem = 2): Promise<Link[]> {
  if (you.length === 0 || everyone.length === 0) return [];
  const scores = await scoreMatrix(env, you, everyone);
  const links: Link[] = [];
  for (const [i, row] of scores.entries()) {
    const best = row
      .map((score, j) => ({ you: you[i].id, everyone: everyone[j].id, score: Math.round(score * 100) / 100 }))
      .filter((link) => link.score >= LINK_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, perItem);
    links.push(...best);
  }
  return links.sort((a, b) => b.score - a.score);
}
