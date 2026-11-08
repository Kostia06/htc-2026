// The only GitHub tools Skillit may ever run through Composio. Every one is a GET that reads; nothing here can create,
// change, star, fork, comment, push or delete. Adding a tool means adding it here, and only a read belongs here.
// Kept to what the import actually calls: a tool nobody uses is one more thing that could be misused.
export const READ_ONLY_GITHUB_TOOLS = ["GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", "GITHUB_GET_A_REPOSITORY_README", "GITHUB_SEARCH_REPOSITORIES"] as const;
