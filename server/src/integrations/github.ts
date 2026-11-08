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


// ERROR HANDLING
// GitHub has special rate limits.
// We preserve useful rate-limit information so our API routes
// can tell clients when they should retry.
export class GitHubApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly retryAfterSeconds: number | null,
        public readonly rateLimitReset: number | null
    ) {
        super(message);
        this.name = "GitHubApiError";
    }
}

// Extract numeric values from HTTP headers safely.
// Number(null) would return 0, so we explicitly check for null.
function readHeaderNumber(
    value: string | null
): number | null {
    if (value === null) return null;

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
}

// Shared headers for every GitHub API request.
function buildHeaders(
    env: Pick<Env, "GITHUB_TOKEN">,
    accept = "application/vnd.github+json"
): Headers {
    const headers = new Headers({
        Accept: accept,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "Skillit-Career-Suggestor",
    });

    // Authentication is optional for public repositories.
    // If a token exists, use it to access authenticated rate limits.
    if (env.GITHUB_TOKEN) {
        headers.set(
            "Authorization",
            `Bearer ${env.GITHUB_TOKEN}`
        );
    }

    return headers;
}

// Read GitHub's rate-limit information from a response.
function getRateLimit(response: Response) {
    return {
        remaining: readHeaderNumber(
            response.headers.get("x-ratelimit-remaining")
        ),

        resetAt: readHeaderNumber(
            response.headers.get("x-ratelimit-reset")
        ),

        retryAfterSeconds: readHeaderNumber(
            response.headers.get("retry-after")
        ),
    };
}

// Convert unsuccessful API responses into useful errors.
// We never include our API token in error messages.
async function createApiError(
    response: Response
): Promise<GitHubApiError> {
    let message =
        `GitHub API request failed: HTTP ${response.status}`;

    try {
        const body = await response.json() as {
            message?: string;
        };

        if (body.message) {
            message = body.message.slice(0, 300);
        }
    } catch {
        // Keep the default error if GitHub doesn't return JSON.
    }

    const rateLimit = getRateLimit(response);
    console.error("GitHub API diagnostic:", {
        url: response.url,
        status: response.status,
        message,
        rateLimit: getRateLimit(response),
    });
    return new GitHubApiError(
        message,
        response.status,
        rateLimit.retryAfterSeconds,
        rateLimit.resetAt
    );
}

// REPO NORMALIZATION
function normalizeRepository(
    raw: GitHubRawRepository
): GitHubRepository {
    return {
        id: raw.id,
        name: raw.name,
        fullName: raw.full_name,

        description: raw.description,

        url: raw.html_url,
        homepage: raw.homepage,

        owner: raw.owner.login,
        ownerAvatar: raw.owner.avatar_url ?? null,

        language: raw.language,
        topics: raw.topics ?? [],

        stars: raw.stargazers_count,
        forks: raw.forks_count,
        watchers: raw.watchers_count,
        openIssues: raw.open_issues_count,

        createdAt: raw.created_at ?? null,
        updatedAt: raw.updated_at ?? null,
        pushedAt: raw.pushed_at ?? null,

        defaultBranch: raw.default_branch,

        license: raw.license?.spdx_id ?? null,

        isFork: raw.fork,
        isArchived: raw.archived,
        isDisabled: raw.disabled,

        relevanceScore:
            typeof raw.score === "number" ? raw.score : null,
    };
}


// SEARCH PUBLIC GITHUB REPO
export async function searchGitHubRepositories(
    env: Pick<Env, "GITHUB_TOKEN">,
    options: GitHubSearchOptions
) {
    const {
        query,
        language,
        topics = [],
        minStars,
        sort = "stars",
        order = "desc",
        page = 1,
        perPage = 20,
        includeForks = false,
        includeArchived = false,
    } = options;


    // Validate search parameter

    const cleanQuery = query.trim();

    if (
        !cleanQuery ||
        cleanQuery.length > 200 ||
        /[\r\n]/.test(cleanQuery)
    ) {
        throw new Error("Invalid GitHub search query.");
    }

    if (
        language &&
        (
            language.trim().length === 0 ||
            language.length > 60 ||
            /[\r\n]/.test(language)
        )
    ) {
        throw new Error("Invalid programming language.");
    }

    if (
        topics.length > 5 ||
        topics.some(
            (topic) =>
                !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,49}$/.test(topic)
        )
    ) {
        throw new Error("Invalid repository topics.");
    }

    if (
        minStars !== undefined &&
        (
            !Number.isInteger(minStars) ||
            minStars < 0 ||
            minStars > 1000000
        )
    ) {
        throw new Error("Invalid minimum star count.");
    }

    const validSorts: GitHubSort[] = [
        "stars",
        "forks",
        "help-wanted-issues",
        "updated",
    ];

    if (!validSorts.includes(sort)) {
        throw new Error("Invalid GitHub sorting option.");
    }

    if (order !== "asc" && order !== "desc") {
        throw new Error("Invalid sort order.");
    }

    if (
        !Number.isInteger(perPage) ||
        perPage < 1 ||
        perPage > MAX_PAGE_SIZE
    ) {
        throw new Error(
            `perPage must be between 1 and ${MAX_PAGE_SIZE}.`
        );
    }

    // GitHub limits repository search to the first 1,000 results.
    const maxPage = Math.ceil(MAX_SEARCH_RESULTS / perPage);

    if (
        !Number.isInteger(page) ||
        page < 1 ||
        page > maxPage
    ) {
        throw new Error(
            `Page must be between 1 and ${maxPage}.`
        );
    }

    // --------------------------
    // Construct GitHub query
    // --------------------------

    // GitHub supports special search qualifiers.
    // We combine the user's search with additional filters.
    const queryParts = [cleanQuery];

    if (language) {
        queryParts.push(`language:${language.trim()}`);
    }

    for (const topic of topics) {
        queryParts.push(`topic:${topic}`);
    }

    if (minStars !== undefined) {
        queryParts.push(`stars:>=${minStars}`);
    }

    if (!includeForks) {
        queryParts.push("fork:false");
    }

    if (!includeArchived) {
        queryParts.push("archived:false");
    }

    const githubQuery = queryParts.join(" ");


    // Construct API URL
    const url = new URL(
        `${GITHUB_API_BASE}/search/repositories`
    );

    // URLSearchParams safely encodes spaces and special characters.
    url.searchParams.set("q", githubQuery);
    url.searchParams.set("sort", sort);
    url.searchParams.set("order", order);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    // Make API request


    const response = await fetch(url.toString(), {
        method: "GET",
        headers: buildHeaders(env),
    });

    console.log("[GitHub] Search API response:", {
        status: response.status,
        tokenConfigured: Boolean(env.GITHUB_TOKEN),
        rateLimitRemaining: response.headers.get("x-ratelimit-remaining"),
        rateLimitResource: response.headers.get("x-ratelimit-resource"),
        retryAfter: response.headers.get("retry-after"),
        requestId: response.headers.get("x-github-request-id"),
    });

    if (!response.ok) {
        throw await createApiError(response);
    }

    if (!response.ok) {
        throw await createApiError(response);
    }

    const data =
        await response.json() as GitHubSearchResponse;


    // Normalize repositories


    const repositories = (
        Array.isArray(data.items) ? data.items : []
    )
        .map(normalizeRepository)
        .filter((repo) => !repo.isDisabled);

    // Return structured results

    return {
        totalCount: data.total_count ?? 0,

        incompleteResults:
            data.incomplete_results ?? false,

        repositories,

        pagination: {
            page,
            perPage,
            maxPage,
        },

        rateLimit: getRateLimit(response),

        retrievedAt: new Date().toISOString(),
    };
}



// 6. GET REPOSITORY PROGRAMMING LANGUAGES
// GitHub provides a separate endpoint for repository languages.
//
// The API returns the number of bytes written in each language.
//
// Example response from GitHub:
// {
//   "Java": 45000,
//   "JavaScript": 15000,
//   "SQL": 5000
// }
//
// We calculate percentages ourselves so the frontend
// can display a language breakdown.
export async function getRepositoryLanguages(
    env: Pick<Env, "GITHUB_TOKEN">,
    owner: string,
    repo: string
) {
    validateRepositoryName(owner, repo);

    const url =
        `${GITHUB_API_BASE}/repos/` +
        `${encodeURIComponent(owner)}/` +
        `${encodeURIComponent(repo)}/languages`;

    const response = await fetch(url, {
        method: "GET",
        headers: buildHeaders(env),
    });

    if (!response.ok) {
        throw await createApiError(response);
    }

    const data =
        await response.json() as Record<string, number>;

    // Convert GitHub's language object into a sorted array.
    const totalBytes = Object.values(data).reduce(
        (total, bytes) => total + bytes,
        0
    );

    const languages = Object.entries(data)
        .map(([name, bytes]) => ({
            name,
            bytes,
            percentage:
                totalBytes > 0
                    ? Number(((bytes / totalBytes) * 100).toFixed(2))
                    : 0,
        }))
        .sort((a, b) => b.bytes - a.bytes);

    return {
        owner,
        repo,
        totalBytes,
        languages,
    };
}


// ============================================================
// 7. GET REPOSITORY README
// ============================================================

// A README usually explains:
// - What the project does.
// - Which technologies it uses.
// - How the project is structured.
// - How to install and run it.
// - What features it provides.
//
// We retrieve the raw Markdown so Gemini can analyze it later.
//
// We limit the returned content to avoid sending huge documents
// to the AI model.
export async function getRepositoryReadme(
    env: Pick<Env, "GITHUB_TOKEN">,
    owner: string,
    repo: string,
    maxCharacters = MAX_README_LENGTH
) {
    validateRepositoryName(owner, repo);

    if (
        !Number.isInteger(maxCharacters) ||
        maxCharacters < 500 ||
        maxCharacters > 50000
    ) {
        throw new Error(
            "README limit must be between 500 and 50000 characters."
        );
    }

    const url =
        `${GITHUB_API_BASE}/repos/` +
        `${encodeURIComponent(owner)}/` +
        `${encodeURIComponent(repo)}/readme`;

    const response = await fetch(url, {
        method: "GET",

        // This media type asks GitHub for raw README content
        // instead of the normal JSON/base64 representation.
        headers: buildHeaders(
            env,
            "application/vnd.github.raw+json"
        ),
    });

    // Some repositories do not have a README.
    // This is not necessarily a failure for our application.
    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw await createApiError(response);
    }

    const rawContent = await response.text();

    // Preserve the original length so we can tell Gemini
    // whether it received the entire README or only part of it.
    const originalLength = rawContent.length;

    const content = rawContent.slice(0, maxCharacters);

    return {
        owner,
        repo,

        content,

        originalLength,

        truncated: originalLength > maxCharacters,

        url: `https://github.com/${owner}/${repo}`,
    };
}


// 8. REPOSITORY NAME VALIDATION
// These checks prevent invalid path parameters from reaching the GitHub endpoints
function validateRepositoryName(
    owner: string,
    repo: string
) {
    const validName = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

    if (!validName.test(owner) || !validName.test(repo)) {
        throw new Error("Invalid GitHub owner or repository name.");
    }
}



// This function combines repository information from
// multiple GitHub endpoints.
//
// First, we have the metadata from repository search.
// Then we retrieve:
// - Programming language breakdown.
// - README documentation.
export async function getRepositorySnapshot(
    env: Pick<Env, "GITHUB_TOKEN">,
    repository: Pick<GitHubRepository, "owner" | "name">
) {
    const { owner, name } = repository;

    const [languageData, readme] = await Promise.all([
        getRepositoryLanguages(env, owner, name),

        getRepositoryReadme(env, owner, name),
    ]);

    return {
        owner,
        repo: name,

        languages: languageData.languages,

        readme,

        retrievedAt: new Date().toISOString(),
    };
}

