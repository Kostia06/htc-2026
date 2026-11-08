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
