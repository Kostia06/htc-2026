import { afterEach, describe, expect, it, vi } from "vitest";
import { devtoArticles } from "../../src/integrations/devto";

afterEach(() => vi.restoreAllMocks());

const article = {
  id: 1,
  title: "My Acme interview loop",
  description: "Phone screen, take-home, onsite.",
  url: "https://dev.to/sam/my-acme-interview-loop-1abc",
  published_at: "2026-10-12T09:00:00Z",
  tag_list: ["interview", "career"],
  reading_time_minutes: 4,
  user: { name: "Sam", username: "sam" },
};

describe("dev.to client", () => {
  it("lists the year's top articles for a tag through the public API", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([article]));
    const [first] = await devtoArticles("interview");
    const url = new URL(spy.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://dev.to/api/articles");
    expect(url.searchParams.get("tag")).toBe("interview");
    expect(url.searchParams.get("top")).toBe("365");
    expect(first).toEqual({
      title: "My Acme interview loop",
      description: "Phone screen, take-home, onsite.",
      url: "https://dev.to/sam/my-acme-interview-loop-1abc",
      author: "Sam",
      published_at: "2026-10-12T09:00:00Z",
      tags: ["interview", "career"],
    });
  });

  it("throws on an HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 429 }));
    await expect(devtoArticles("interview")).rejects.toThrow("dev.to HTTP 429");
  });
});
