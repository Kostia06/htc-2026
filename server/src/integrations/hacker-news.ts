import { plainText } from "../lib/plain-text";
import { USER_AGENT } from "../lib/user-agent";

const API = "https://hn.algolia.com/api/v1/search";
const LOOKBACK_DAYS = 730;
const HITS = 10;
const EXCERPT = 300;

export type HackerNewsHit = {
  title: string;
  // the discussion on news.ycombinator.com, to link and attribute
  url: string;
  // the article a story points at, if any; often a company's own "how we hire" post
  link: string | null;
  author: string;
  points: number | null;
  created_at: string;
  excerpt: string;
};

type RawHit = {
  objectID: string;
  title?: string | null;
  story_title?: string | null;
  url?: string | null;
  author?: string;
  points?: number | null;
  created_at?: string;
  story_text?: string | null;
  comment_text?: string | null;
};

const toHit = (raw: RawHit): HackerNewsHit => ({
  title: raw.title || raw.story_title || "",
  url: `https://news.ycombinator.com/item?id=${encodeURIComponent(raw.objectID)}`,
  link: raw.url || null,
  author: raw.author ?? "",
  points: raw.points ?? null,
  created_at: raw.created_at ?? "",
  excerpt: plainText(raw.story_text || raw.comment_text || "", EXCERPT),
});

export async function hackerNewsSearch(query: string, now = new Date()): Promise<HackerNewsHit[]> {
  const since = Math.floor(now.getTime() / 1000) - LOOKBACK_DAYS * 86_400;
  const params = new URLSearchParams({ query, tags: "(story,comment)", numericFilters: `created_at_i>${since}`, hitsPerPage: String(HITS) });
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HN search HTTP ${res.status}`);
  const json = await res.json<{ hits?: RawHit[] }>();
  return (json.hits ?? []).filter((h) => h.objectID).map(toHit);
}
