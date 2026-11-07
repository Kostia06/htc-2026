import type { Env } from "../env";
import type { SearchResult } from "./tools";

const API = "https://api.keenable.ai/v1";

async function call<T>(env: Env, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-API-Key": env.KEENABLE_API_KEY },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json<T>();
}

type RawResult = { title?: string; url?: string; snippet?: string; description?: string };

export async function keenableSearch(env: Env, query: string): Promise<SearchResult[]> {
  const json = await call<{ results?: RawResult[] }>(env, "/search", { method: "POST", body: JSON.stringify({ query }) });
  return (json.results ?? [])
    .map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.snippet || r.description || "" }))
    .filter((r) => r.url);
}

export async function keenableFetch(env: Env, url: string) {
  const json = await call<{ content?: string }>(env, `/fetch?url=${encodeURIComponent(url)}`);
  return json.content ?? "";
}
