import type { Env } from "../../env";
import type { JobPosting, JobQuery } from "../../integrations/adzuna";
import type { DevtoArticle } from "../../integrations/devto";
import type { HackerNewsHit } from "../../integrations/hacker-news";
import type { JsonSchema } from "../../lib/json-schema";
import type { NewFact } from "../../memory/facts";
import type { getCompanyInsights } from "../../memory/insights";
import type { Model, ToolCallRecord } from "./loop";

export type Platform = "app" | "vr" | "background";
export const PLATFORMS: readonly Platform[] = ["app", "vr", "background"];

import type { MemoryKind, PrivateMemory } from "../../memory/private/store";
import type { Profile, ProfilePatch } from "../../memory/profile/types";
import type { RepoSummary } from "../../connections/store";

export type { MemoryKind, PrivateMemory };
export type PrivateMemoryPort = {
  recall(opts?: { query?: string; kinds?: MemoryKind[]; limit?: number }): Promise<PrivateMemory[]>;
  remember(item: { kind: MemoryKind; text: string }): Promise<PrivateMemory>;
  profile(): Promise<Profile>;
  updateProfile(patch: ProfilePatch): Promise<Profile>;
  // the person's imported GitHub repos as Skillit keeps them (allowlisted facts, grounded summaries); [] when not connected
  githubProjects(): Promise<RepoSummary[]>;
};
export const MEMORY_KINDS: readonly MemoryKind[] = ["goal", "skill", "weakness", "preference", "note"];

export type SearchResult = { title: string; url: string; snippet: string };
export type CompanyFactHit = { kind: string; text: string; source_url?: string; score: number };
export type CompanyInsights = NonNullable<Awaited<ReturnType<typeof getCompanyInsights>>>;
export type CompanyRef = { id: string; slug: string; name: string; website: string | null };

// everything outside the Worker a tool can reach; tests swap in fakes
export type Services = {
  search(query: string): Promise<SearchResult[]>;
  fetchPage(url: string): Promise<string>;
  // null when robots.txt could not be read, which counts as "not allowed"
  fetchRobots(origin: string): Promise<string | null>;
  // false while the host's Crawl-delay since our last fetch from it has not passed
  claimFetchSlot(host: string, delaySeconds: number): Promise<boolean>;
  claimCooldown(scope: string, key: string, cooldownMs: number): Promise<boolean>;
  jobPostings(query: JobQuery): Promise<JobPosting[]>;
  hackerNews(query: string): Promise<HackerNewsHit[]>;
  devtoArticles(tag: string): Promise<DevtoArticle[]>;
  companyFacts(companyId: string, query: string): Promise<CompanyFactHit[]>;
  saveFact(companyId: string, fact: NewFact): Promise<{ saved: boolean; reason?: string }>;
  companyInsights(slug: string, role?: string): Promise<CompanyInsights | null>;
  claimResearch(slug: string): Promise<boolean>;
  // returns once the run is recorded, false while on cooldown; the research itself continues in the background
  startResearch(slug: string): Promise<boolean>;
};

export type ToolContext = {
  env: Env;
  userId: string;
  company?: CompanyRef;
  platform: Platform;
  fetchedPages: Set<string>;
  triedPages: Set<string>;
  memory: PrivateMemoryPort;
  services: Services;
  // the text a skill was given, so tools can check that quoted evidence really comes from it
  groundingText?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: JsonSchema;
  terminal?: boolean;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
};

export type SkillOutput = Record<string, unknown>;

export type Skill<Input = unknown> = {
  name: string;
  description: string;
  platforms: Platform[];
  // false keeps private memory out of the prompt and the tools, e.g. for research that writes global facts
  personal: boolean;
  tools: string[];
  maxSteps: number;
  instructions: string;
  // when the input has a `company` slug, the harness resolves it into ctx.company before the run
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  buildGoal(input: Input, ctx: ToolContext): string;
  groundingText?(input: Input): string;
  // checked on every entry path before a run is recorded; false means "ran recently, not again yet"
  claim?(input: Input, services: Services): Promise<boolean>;
  // replaces model-reported fields with ones derived from what the tools actually did
  finalize?(output: SkillOutput, toolCalls: ToolCallRecord[], input?: Input): SkillOutput;
};

// the tools one agent holds, keyed by name; a skill can only be bound to tools from its own agent's toolbox
export type Toolbox = Record<string, ToolDefinition>;

export type RunRequest = { skill: Skill; tools: Toolbox; platform: Platform; userId: string; input: unknown };

export type RunResult =
  | { runId: string; status: "done"; output: SkillOutput; toolCalls: ToolCallRecord[] }
  | { runId: string; status: "failed"; error: string; toolCalls: ToolCallRecord[] };

export type AgentDeps = {
  env: Env;
  model(systemPrompt: string): Model;
  memoryFor(userId: string): PrivateMemoryPort;
  services: Services;
};
