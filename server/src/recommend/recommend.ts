import type { ToolCallRecord } from "../agents/core/loop";
import { LABELS, nextStep } from "./phrasing";
import type { ProfileReader, ProfileSnapshot } from "./profile";
import { rankByGoals } from "./rank";
import { fetchedPages, pageText } from "./sources";
import type { Assessment, Requirement } from "./types";
import { verifyRequirements } from "./verify";

// what the model hands in per item: extracted quotes and suggestions, never a level
export type DraftItem = {
  title: string;
  source_url: string;
  requirements: Requirement[];
  next_step: string;
  // the concrete route there, used when the item turns out long term
  path: string;
  question?: string;
};

export type Checked = { requirements: Requirement[]; source: string; profile: ProfileSnapshot };
export type Verdict = { assessment: Assessment; note?: string } | { notAFit: string };
export type Judge<D extends DraftItem> = (draft: D, checked: Checked) => Verdict;

export function recommend<D extends DraftItem>(drafts: D[], toolCalls: ToolCallRecord[], opts: { readProfile: ProfileReader; judge: Judge<D> }) {
  const pages = fetchedPages(toolCalls);
  const profile = opts.readProfile(toolCalls);
  const items = [];
  const notAFit = [];

  for (const draft of drafts) {
    const source = pageText(pages, draft.source_url);
    // a page we never read leaves nothing to check its quotes against
    if (source === undefined) continue;
    const { requirements } = verifyRequirements(draft.requirements, { source, profile: profile.text });
    const verdict = opts.judge(draft, { requirements, source, profile });
    if ("notAFit" in verdict) notAFit.push({ title: draft.title, source_url: draft.source_url, reason: verdict.notAFit });
    else items.push(present(draft, verdict.assessment, verdict.note));
  }

  const ranked = rankByGoals(items, profile.goals);
  // one question at a time, the one for the highest-ranked item we can't judge yet
  const question = ranked.find((item) => item.level === "cant_tell")?.next_step;
  return { items: ranked, not_a_fit: notAFit, ...(question ? { question } : {}) };
}

function present(draft: DraftItem, assessment: Assessment, note?: string) {
  const { level, counts, matched, missing, unknown, reasons } = assessment;
  return {
    title: draft.title,
    source_url: draft.source_url,
    level,
    label: LABELS[level],
    counts,
    matched,
    missing,
    unknown,
    reasons,
    next_step: nextStep(draft, assessment),
    ...(note ? { note } : {}),
  };
}
