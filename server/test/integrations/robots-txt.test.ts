import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRobotsTxt } from "../../src/integrations/robots-txt";

afterEach(() => vi.restoreAllMocks());

const respond = (body: string, status: number) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status }));

describe("robots.txt fetcher", () => {
  it("asks the site itself, with our user agent", async () => {
    const spy = respond("User-agent: *\nDisallow: /", 200);
    expect(await fetchRobotsTxt("https://acme.com", "HTCMentorBot/1.0")).toBe("User-agent: *\nDisallow: /");
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://acme.com/robots.txt");
    expect(new Headers(init.headers).get("User-Agent")).toBe("HTCMentorBot/1.0");
  });

  it("reads a missing robots.txt as allow-all", async () => {
    respond("not found", 404);
    expect(await fetchRobotsTxt("https://acme.com", "Bot")).toBe("");
  });

  it.each([403, 429, 500, 503])("treats HTTP %i as unknown, not as permission", async (status) => {
    respond("blocked", status);
    expect(await fetchRobotsTxt("https://acme.com", "Bot")).toBeNull();
  });

  it("treats a network failure as unknown", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await fetchRobotsTxt("https://acme.com", "Bot")).toBeNull();
  });
});
