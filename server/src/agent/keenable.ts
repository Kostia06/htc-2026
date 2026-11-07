import type { Env } from "../env";
import type { SearchResult } from "./tools";

const API = "https://api.keenable.ai/v1";

async function call<T>(env: Env, path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": env.KEENABLE_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json<T>();
}

type RawResult = { title?: string; url?: string; link?: string; snippet?: string; description?: string; content?: string };

export async function keenableSearch(env: Env, query: string): Promise<SearchResult[]> {
  const json = await call<{ results?: RawResult[]; data?: RawResult[] }>(env, "/search", { query });
  return (json.results ?? json.data ?? [])
    .map((r) => ({ title: r.title ?? "", url: r.url ?? r.link ?? "", snippet: r.snippet ?? r.description ?? r.content ?? "" }))
    .filter((r) => r.url);
}

export async function keenableFetch(env: Env, url: string) {
  const json = await call<{ content?: string; text?: string; markdown?: string }>(env, "/fetch", { url });
  return json.markdown ?? json.content ?? json.text ?? "";
}
