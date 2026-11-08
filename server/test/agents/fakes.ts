import { env } from "cloudflare:workers";
import { vi } from "vitest";
import type { Declaration } from "../../src/agents/core/loop";
import type { AgentDeps, PrivateMemory, PrivateMemoryPort, Services, ToolContext } from "../../src/agents/core/types";
import type { GeminiContent } from "../../src/integrations/gemini";
import { applyPatch, emptyProfile } from "../../src/memory/profile/patch";

export const ACME = { id: "c1", slug: "acme", name: "Acme", website: "https://acme.com" };

export function fakeServices(over: Partial<Services> = {}): Services {
  return {
    search: vi.fn(async () => [
      { title: "Acme careers", url: "https://acme.com/careers", snippet: "We hire juniors" },
      { title: "Acme reviews", url: "https://www.glassdoor.ca/acme", snippet: "..." },
    ]),
    fetchPage: vi.fn(async () => "Acme interviews have a take-home."),
    fetchRobots: vi.fn(async () => ""),
    claimFetchSlot: vi.fn(async () => true),
    claimCooldown: vi.fn(async () => true),
    jobPostings: vi.fn(async () => []),
    hackerNews: vi.fn(async () => []),
    devtoArticles: vi.fn(async () => []),
    companyFacts: vi.fn(async () => []),
    saveFact: vi.fn(async () => ({ saved: true })),
    companyInsights: vi.fn(async () => null),
    claimResearch: vi.fn(async () => true),
    startResearch: vi.fn(async () => true),
    ...over,
  };
}

export type FakeMemory = PrivateMemoryPort & { items: PrivateMemory[] };

export function fakeMemory(seed: Pick<PrivateMemory, "kind" | "text">[] = []): FakeMemory {
  const items: PrivateMemory[] = [];
  let profile = emptyProfile();
  const memory: FakeMemory = {
    items,
    profile: vi.fn(async () => profile),
    updateProfile: vi.fn(async (patch) => (profile = applyPatch(profile, patch))),
    githubProjects: vi.fn(async () => []),
    recall: vi.fn(async (opts = {}) =>
      items
        .filter((m) => !opts.kinds || opts.kinds.includes(m.kind))
        .filter((m) => !opts.query || m.text.toLowerCase().includes(opts.query.toLowerCase()))
        .slice(0, opts.limit ?? 20),
    ),
    remember: vi.fn(async ({ kind, text }) => {
      const now = new Date().toISOString();
      const item = { id: crypto.randomUUID(), kind, text, createdAt: now, lastUsedAt: now, uses: 0 };
      items.push(item);
      return item;
    }),
  };
  for (const item of seed) void memory.remember(item);
  return memory;
}

export function toolContext(over: Partial<ToolContext> = {}): ToolContext {
  return {
    env,
    userId: "u1",
    company: ACME,
    platform: "app",
    fetchedPages: new Set(),
    triedPages: new Set(),
    memory: fakeMemory(),
    services: fakeServices(),
    ...over,
  };
}

export const call = (name: string, args: Record<string, unknown> = {}): GeminiContent => ({
  role: "model",
  parts: [{ functionCall: { name, args } }],
});

// a model that plays back fixed replies and remembers every prompt, conversation and tool list it saw
function scriptedModel(replies: GeminiContent[]) {
  const prompts: string[] = [];
  const conversations: GeminiContent[][] = [];
  const toolNames: string[][] = [];
  const model = (systemPrompt: string) => {
    prompts.push(systemPrompt);
    return async (contents: GeminiContent[], declarations: Declaration[]) => {
      conversations.push(structuredClone(contents));
      toolNames.push(declarations.map((d) => d.name));
      return replies.shift() ?? { role: "model", parts: [{ text: "out of replies" }] };
    };
  };
  return { model, prompts, conversations, toolNames };
}

export function fakeDeps(over: Partial<AgentDeps> & { replies?: GeminiContent[]; memory?: FakeMemory } = {}) {
  const scripted = scriptedModel(over.replies ?? []);
  const memory = over.memory ?? fakeMemory();
  const memoryFor = vi.fn(() => memory);
  const deps: AgentDeps = { env, model: scripted.model, memoryFor, services: fakeServices(), ...over };
  return { deps, memory, memoryFor, ...scripted };
}
