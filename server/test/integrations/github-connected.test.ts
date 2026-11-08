import { afterEach, describe, expect, it, vi } from "vitest";
import { searchGitHubRepositories } from "../../src/integrations/github";

afterEach(() => vi.unstubAllGlobals());

const raw = {
  id: 7, name: "k8s-demo", full_name: "a/k8s-demo", description: "demo", html_url: "https://github.com/a/k8s-demo", homepage: null,
  owner: { login: "a" }, language: "Go", topics: [], stargazers_count: 40, forks_count: 1, watchers_count: 40, open_issues_count: 0,
  default_branch: "main", license: null, fork: false, archived: false, disabled: false,
};

describe("searchGitHubRepositories with the person's connected GitHub", () => {
  it("searches through the connection and never uses the shared token", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const read = vi.fn().mockResolvedValue({ details: { total_count: 1, items: [raw] } });

    const result = await searchGitHubRepositories({ GITHUB_TOKEN: "shared" }, { query: "Kubernetes", minStars: 5, perPage: 5 }, read);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(read.mock.calls[0][0]).toMatchObject({ q: "Kubernetes stars:>=5 fork:false archived:false", per_page: 5 });
    expect(result.repositories.map((r) => r.fullName)).toEqual(["a/k8s-demo"]);
  });

  it("falls back to the shared token when the connection fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ total_count: 1, items: [raw] }), { status: 200 })));
    const read = vi.fn().mockRejectedValue(new Error("composio down"));

    const result = await searchGitHubRepositories({ GITHUB_TOKEN: "shared" }, { query: "Kubernetes" }, read);

    expect(result.repositories).toHaveLength(1);
  });
});
