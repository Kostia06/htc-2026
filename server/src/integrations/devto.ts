import { USER_AGENT } from "../lib/user-agent";

// the API has no free-text search (dev.to/search is off limits in its robots.txt), so we list by tag
const API = "https://dev.to/api/articles";
const PER_PAGE = 30;
const TOP_DAYS = 365;

export type DevtoArticle = { title: string; description: string; url: string; author: string; published_at: string; tags: string[] };

type RawArticle = {
  title?: string;
  description?: string;
  url?: string;
  published_at?: string;
  tag_list?: string[];
  user?: { name?: string; username?: string };
};

const toArticle = (raw: RawArticle): DevtoArticle => ({
  title: raw.title ?? "",
  description: raw.description ?? "",
  url: raw.url ?? "",
  author: raw.user?.name || raw.user?.username || "",
  published_at: raw.published_at ?? "",
  tags: raw.tag_list ?? [],
});

export async function devtoArticles(tag: string): Promise<DevtoArticle[]> {
  const params = new URLSearchParams({ tag, top: String(TOP_DAYS), per_page: String(PER_PAGE) });
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`dev.to HTTP ${res.status}`);
  const json = await res.json<RawArticle[]>();
  return (Array.isArray(json) ? json : []).map(toArticle).filter((a) => a.url);
}
