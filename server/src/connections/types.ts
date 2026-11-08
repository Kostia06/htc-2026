import type { AgentDeps } from "../agents/core/types";

export const PROVIDERS = ["github", "gitlab", "bitbucket", "dribbble", "notion", "googledrive", "youtube"] as const;
export type ProviderId = (typeof PROVIDERS)[number];
export type Category = "code" | "design" | "writing" | "documents" | "video";

// one imported piece of work as Skillit keeps it: allowlisted facts and a summary grounded in the item's own text or metadata
export type WorkItem = {
  name: string;
  summary?: string;
  // a repo's main language
  language?: string;
  // what kind of thing it is when that isn't obvious from the provider ("Slides", "Video", "Shot")
  kind?: string;
  topics: string[];
  stars?: number;
  updatedAt?: string;
};

export type Reader = (slug: string, args: Record<string, unknown>) => Promise<unknown>;
export type ImportContext = { deps: AgentDeps; userId: string };
export type Imported = { items: WorkItem[]; suggestions: string[] };

/**
 * One outside service a person can bring their work from, read-only through Composio. Everything specific to the service
 * lives here: which Composio toolkit and version, the only tools that may run, and how its answers become work items.
 */
export type Connector = {
  id: ProviderId;
  name: string;
  category: Category;
  // Composio's toolkit slug, lowercase as its API uses it
  toolkit: string;
  // pinned so a tool's response shape can't change under the import
  toolkitVersion: string;
  // one line for the UI saying what is read and that nothing is written
  reads: string;
  // the only tools that may ever run on this connection; each one only reads
  readTools: readonly string[];
  importItems(read: Reader, ctx: ImportContext): Promise<Imported>;
};
