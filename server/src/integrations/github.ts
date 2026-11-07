import type {Env} from "../env"

// GitHub REST API base URL.
const GITHUB_API_BASE = "https://api.github.com";

// API version based on the GitHub documentation.
const GITHUB_API_VERSION = "2026-03-10";

// GitHub repository search has a maximum accessible result window
// of 1,000 results, even when more repositories match.
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_RESULTS = 1000;

// Maximum README content we will pass to Gemini later.
// This prevents unnecessarily large API responses and AI prompts.
export const MAX_README_LENGTH = 15000;

// TYPES

// Sorting options supported by GitHub repository search.
export type GitHubSort =
    | "stars"
    | "forks"
    | "help-wanted-issues"
    | "updated";

export type GitHubOrder = "asc" | "desc";

// Parameters accepted by our repository search function.
export type GitHubSearchOptions = {
    query: string;
    language?: string;
    topics?: string[];

    minStars?: number;

    sort?: GitHubSort;
    order?: GitHubOrder;

    page?: number;
    perPage?: number;

    includeForks?: boolean;
    includeArchived?: boolean;
};

// Structure of a repository after normalization.
// We use camelCase throughout our application.
export type GitHubRepository = {
    id: number;
    name: string;
    fullName: string;
    description: string | null;

    url: string;
    homepage: string | null;

    owner: string;
    ownerAvatar: string | null;

    language: string | null;
    topics: string[];

    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;

    createdAt: string | null;
    updatedAt: string | null;
    pushedAt: string | null;

    defaultBranch: string;

    license: string | null;

    isFork: boolean;
    isArchived: boolean;
    isDisabled: boolean;

    relevanceScore: number | null;
};

// GitHub returns repository metadata using snake_case.
// This type represents the original API response.
type GitHubRawRepository = {
    id: number;
    name: string;
    full_name: string;

    description: string | null;

    html_url: string;
    homepage: string | null;

    owner: {
        login: string;
        avatar_url?: string;
    };

    language: string | null;
    topics?: string[];

    stargazers_count: number;
    forks_count: number;
    watchers_count: number;
    open_issues_count: number;

    created_at?: string;
    updated_at?: string;
    pushed_at?: string;

    default_branch: string;

    license?: {
        name: string;
        spdx_id: string | null;
    } | null;

    fork: boolean;
    archived: boolean;
    disabled: boolean;

    score?: number;
};

// Overall response returned by GitHub repository search.
type GitHubSearchResponse = {
    total_count: number;
    incomplete_results: boolean;
    items: GitHubRawRepository[];
};
