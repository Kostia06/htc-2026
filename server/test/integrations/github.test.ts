
import { describe, it, expect, vi, afterEach } from "vitest";
import {
    searchGitHubRepositories,
    GitHubApiError,
} from "../../src/integrations/github";

afterEach(() => {
    vi.unstubAllGlobals();
});

// Test 1: Successful GitHub repository search.
describe("GitHub integration", () => {
    it("should retrieve and normalize repositories", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        total_count: 1,
                        incomplete_results: false,
                        items: [
                            {
                                id: 123,
                                name: "inventory-management",
                                full_name: "test-user/inventory-management",
                                description: "Backend inventory application",
                                html_url: "https://github.com/test-user/inventory-management",
                                homepage: null,
                                owner: {
                                    login: "test-user",
                                    avatar_url: "https://example.com/avatar.png",
                                },
                                language: "Java",
                                topics: ["spring-boot", "postgresql"],
                                stargazers_count: 250,
                                forks_count: 75,
                                watchers_count: 250,
                                open_issues_count: 5,
                                default_branch: "main",
                                license: {
                                    name: "MIT License",
                                    spdx_id: "MIT",
                                },
                                fork: false,
                                archived: false,
                                disabled: false,
                            },
                        ],
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                            "x-ratelimit-remaining": "29",
                        },
                    }
                )
            )
        );

        const result = await searchGitHubRepositories(
            { GITHUB_TOKEN: "test-token" },
            {
                query: "backend developer project",
                language: "Java",
                minStars: 50,
                sort: "stars",
                perPage: 10,
            }
        );

        expect(result.totalCount).toBe(1);
        expect(result.repositories).toHaveLength(1);

        expect(result.repositories[0].fullName).toBe(
            "test-user/inventory-management"
        );

        expect(result.repositories[0].language).toBe("Java");
        expect(result.repositories[0].stars).toBe(250);
        expect(result.repositories[0].license).toBe("MIT");
    });

    // Test 2: Invalid search input should be rejected.
    it("should reject an empty search query", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            searchGitHubRepositories(
                {},
                { query: "" }
            )
        ).rejects.toThrow("Invalid GitHub search query.");

        expect(fetchMock).not.toHaveBeenCalled();
    });

    // Test 3: GitHub API errors should be handled.
    it("should handle GitHub API errors", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        message: "API rate limit exceeded",
                    }),
                    { status: 403 }
                )
            )
        );

        await expect(
            searchGitHubRepositories(
                { GITHUB_TOKEN: "test-token" },
                { query: "backend" }
            )
        ).rejects.toBeInstanceOf(GitHubApiError);
    });
});
