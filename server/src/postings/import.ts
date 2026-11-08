import { MAX_POSTING_TEXT, type ImportPostingInput, type PostingDraft } from "../agents/career/skills/import-posting";
import type { AgentDeps, ToolContext } from "../agents/core/types";
import { orchestrate } from "../agents/orchestrator";
import { fetchPage } from "../agents/shared-tools/fetch-page";
import { backgroundOf } from "../roadmap/background";
import { markRequirements } from "./match";
import { prefillFromPosting } from "./prefill";
import { newPostingId, savePosting } from "./store";
import type { Posting } from "./types";

/** The page can't be read for us (blocked site, robots.txt, unreadable); the app asks the person to paste the text instead. */
export class NeedsText extends Error {}
export class ImportFailed extends Error {}

export type ImportRequest = { userId: string; url?: string; text?: string };

const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const clipAll = (values: unknown, max: number, item: number) =>
  Array.isArray(values) ? values.map((v) => clip(v, item)).filter(Boolean).slice(0, max) : [];

// the same fetcher the research agent uses, so the robots.txt and off-limits rules apply to a pasted link too
async function readPosting(deps: AgentDeps, userId: string, url: string): Promise<string> {
  const ctx: ToolContext = {
    env: deps.env,
    userId,
    platform: "app",
    fetchedPages: new Set(),
    triedPages: new Set(),
    memory: deps.memoryFor(userId),
    services: deps.services,
  };
  const page = (await fetchPage.run({ url }, ctx)) as { skipped?: boolean; reason?: string; text?: string };
  if (page.skipped || !page.text) throw new NeedsText(page.reason ?? "the page could not be read");
  return page.text;
}

/** One posting in: the model reads it, code marks what the person has, and their roadmap, profile and companies are set up for it. */
export async function importPosting(deps: AgentDeps, request: ImportRequest): Promise<Posting> {
  const memory = deps.memoryFor(request.userId);
  const [text, profile] = await Promise.all([
    request.url ? readPosting(deps, request.userId, request.url) : Promise.resolve(request.text ?? ""),
    memory.profile(),
  ]);
  const input: ImportPostingInput = { text: text.slice(0, MAX_POSTING_TEXT), background: backgroundOf(profile) || undefined };
  const run = await orchestrate(deps, { skillId: "import-posting", platform: "app", userId: request.userId, input });
  if (run.status === "failed") throw new ImportFailed(run.error);

  const draft = run.output as PostingDraft;
  const title = clip(draft.title, 120);
  const company = clip(draft.company, 120);
  if (!title || !company) throw new ImportFailed("the posting named no role or no company");

  const requirements = markRequirements(
    (draft.requirements ?? []).map((r) => ({ text: clip(r.text, 120), topic: clip(r.topic, 40), required: r.required !== false, evidence: r.evidence })).filter((r) => r.text),
    profile,
  );
  const id = newPostingId();
  const prefilled = await prefillFromPosting(deps, { userId: request.userId, postingId: id, title, company, requirements });
  return savePosting(deps.env, request.userId, id, {
    title,
    company,
    companySlug: prefilled.company?.slug ?? null,
    location: clip(draft.location, 80) || null,
    seniority: clip(draft.seniority, 40) || null,
    requirements,
    responsibilities: clipAll(draft.responsibilities, 5, 160),
    skills: clipAll(draft.skills, 20, 60),
    sourceUrl: request.url ?? null,
    prefilled,
  });
}
