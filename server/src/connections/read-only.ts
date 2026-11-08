// Every connector names the only Composio tools that may run on its connections, and each of those only reads: nothing
// here can create, change, post, share, star, comment or delete. Checked at run time as well as by review, so a cast or a
// string from anywhere else still can't reach Composio, and one service's tool can't run on another service's connection.

export class WriteToolRefused extends Error {
  constructor(slug: string, service: string) {
    super(`refused to run ${slug}: Skillit's ${service} access is read-only`);
  }
}

export function assertReadOnlyTool(connector: { name: string; readTools: readonly string[] }, slug: string) {
  if (!connector.readTools.includes(slug)) throw new WriteToolRefused(slug, connector.name);
}

// Any other app has no hand-written allowlist, so a tool must pass two independent checks. By name first, before any
// request: it belongs to that app's toolkit, says it reads, and has no word that writes or reaches a credential. Then by
// Composio's own metadata (readOnlyTool below), checked against the tool's definition before it runs.
const READ_WORDS = new Set(["GET", "LIST", "SEARCH", "FETCH", "FIND", "READ", "RETRIEVE", "LOOKUP", "VIEW", "DESCRIBE", "WHO"]);
const REFUSED_WORDS = new Set([
  // writes of any kind
  "CREATE", "UPDATE", "DELETE", "REMOVE", "ADD", "SET", "PUT", "POST", "PATCH", "EDIT", "MODIFY", "WRITE", "INSERT", "APPEND",
  "UPSERT", "REPLACE", "SEND", "REPLY", "FORWARD", "SHARE", "INVITE", "UPLOAD", "MOVE", "COPY", "RENAME", "ARCHIVE",
  "UNARCHIVE", "RESTORE", "TRASH", "STAR", "UNSTAR", "LIKE", "REACT", "COMMENT", "PUBLISH", "SUBMIT", "APPROVE", "REJECT",
  "MERGE", "CLOSE", "OPEN", "LOCK", "UNLOCK", "ASSIGN", "UNASSIGN", "MARK", "RESOLVE", "UNRESOLVE", "ENABLE", "DISABLE",
  "START", "STOP", "CANCEL", "TRIGGER", "DISPATCH", "SUBSCRIBE", "UNSUBSCRIBE", "FOLLOW", "UNFOLLOW", "JOIN", "LEAVE", "KICK",
  "BAN", "BLOCK", "MUTE", "PIN", "UNPIN", "SCHEDULE", "BOOK", "PAY", "CHARGE", "REFUND", "TRANSFER", "IMPORT", "SYNC",
  "EXECUTE", "RUN", "MUTATION", "INVOKE", "CALL", "REVOKE", "GRANT", "INSTALL", "UNINSTALL", "DEPLOY", "FORK", "COMMIT",
  "PUSH", "TAG", "LABEL", "DRAFT", "SAVE", "STORE", "CLEAR", "RESET", "GENERATE", "CONVERT", "TRANSLATE", "SUMMARIZE",
  // credentials and secrets, even when only read
  "SECRET", "SECRETS", "TOKEN", "TOKENS", "PASSWORD", "PASSWORDS", "CREDENTIAL", "CREDENTIALS", "KEY", "KEYS", "OAUTH", "AUTH",
]);

const toolkitPrefix = (toolkit: string) => `${toolkit.toUpperCase().replace(/-/g, "_")}_`;

export function assertReadOnlyAppTool(toolkit: string, slug: string) {
  const prefix = toolkitPrefix(toolkit);
  if (!/^[A-Z0-9_]{1,120}$/.test(slug) || !slug.startsWith(prefix)) throw new WriteToolRefused(slug, toolkit);
  const words = slug.slice(prefix.length).split("_");
  if (!words.some((w) => READ_WORDS.has(w)) || words.some((w) => REFUSED_WORDS.has(w))) throw new WriteToolRefused(slug, toolkit);
}

const WRITE_HINTS = ["createHint", "updateHint", "destructiveHint"];

/** Composio tags each tool with MCP-style hints: a read is marked readOnlyHint and carries none of the write hints. */
export function readOnlyTool(tool: { slug: string; tags?: unknown; toolkit?: { slug?: unknown } }, toolkit: string): boolean {
  const tags = Array.isArray(tool.tags) ? tool.tags : [];
  if (tool.toolkit?.slug !== toolkit || !tags.includes("readOnlyHint") || tags.some((t) => WRITE_HINTS.includes(t))) return false;
  try {
    assertReadOnlyAppTool(toolkit, tool.slug);
    return true;
  } catch {
    return false;
  }
}
