import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { keenableFetch, keenableSearch } from "../src/agent/keenable";

afterEach(() => vi.restoreAllMocks());

describe("keenable client", () => {
  it("fetches a page with GET ?url= and returns its content", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ url: "https://a.com/", title: "A", content: "hello" }));
    expect(await keenableFetch(env, "https://a.com/")).toBe("hello");
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.keenable.ai/v1/fetch?url=https%3A%2F%2Fa.com%2F");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("maps search results to title, url and snippet", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ results: [{ title: "T", url: "https://a.com", description: "", snippet: "S" }] }),
    );
    expect(await keenableSearch(env, "q")).toEqual([{ title: "T", url: "https://a.com", snippet: "S" }]);
  });
});
