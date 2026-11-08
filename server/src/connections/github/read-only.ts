// The only GitHub tools Skillit may ever run through Composio. Every one is a GET that reads; nothing here can create,
// change, star, fork, comment, push or delete. Adding a tool means adding it here, and only a read belongs here.
// Kept to what the import actually calls: a tool nobody uses is one more thing that could be misused.
export const READ_ONLY_GITHUB_TOOLS = ["GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", "GITHUB_GET_A_REPOSITORY_README"] as const;

export type ReadOnlyGithubTool = (typeof READ_ONLY_GITHUB_TOOLS)[number];

export class WriteToolRefused extends Error {
  constructor(slug: string) {
    super(`refused to run ${slug}: Skillit's GitHub access is read-only`);
  }
}

const allowed = new Set<string>(READ_ONLY_GITHUB_TOOLS);

// checked at run time as well as by the type, so a cast or a string from anywhere else still can't reach Composio
export function assertReadOnlyTool(slug: string): asserts slug is ReadOnlyGithubTool {
  if (!allowed.has(slug)) throw new WriteToolRefused(slug);
}
