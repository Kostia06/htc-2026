import type { Account } from "../../auth/account";
import type { TailorInput } from "../../agents/resume/skills/resume-tailor";
import type { AgentDeps } from "../../agents/core/types";
import { orchestrate } from "../../agents/orchestrator";
import { importPosting } from "../../postings/import";
import { findPosting } from "../../postings/store";
import type { Posting } from "../../postings/types";
import { backgroundOf, skillsOf } from "../../roadmap/background";
import { editablePaths } from "../coach";
import { loadResume } from "../store";
import { applyChanges, matchSummary, skillsChange } from "./apply";
import { saveTailored } from "./store";
import type { TailorChange, TailoredResume } from "./types";

export class PostingNotFound extends Error {}
export class NothingToTailor extends Error {}
export class TailorFailed extends Error {}

// account: the sign-in's name and email, so the tailored copy's header is as full as the base resume's
export type TailorRequest = { userId: string; postingId?: string; text?: string; account?: Account };

/** One job in, one saved tailored copy out: the model proposes, code grounds every change, and the base resume is never touched. */
export async function tailorResume(deps: AgentDeps, request: TailorRequest): Promise<TailoredResume> {
  const saved = request.postingId ? await findPosting(deps.env, request.userId, request.postingId) : null;
  if (request.postingId && !saved) throw new PostingNotFound();
  const [{ resume: base }, profile] = await Promise.all([loadResume(deps.env, request.userId, request.account), deps.memoryFor(request.userId).profile()]);
  // before a pasted posting is imported, so an empty resume doesn't spend that model call
  if (editablePaths(base).length === 0 && base.skills.length === 0) throw new NothingToTailor();
  const posting: Posting = saved ?? (await importPosting(deps, { userId: request.userId, text: request.text }));
  const requirements = posting.requirements.map(({ text, topic, required }) => ({ text, topic, required }));

  let changes: TailorChange[] = [];
  if (editablePaths(base).length > 0) {
    const input: TailorInput = { resume: base, requirements, profileText: backgroundOf(profile), title: posting.title, companyName: posting.company };
    const run = await orchestrate(deps, { skillId: "resume-tailor", platform: "app", userId: request.userId, input });
    if (run.status === "failed") throw new TailorFailed(run.error);
    changes = (run.output.changes ?? []) as TailorChange[];
  }
  const skills = skillsChange(base, requirements, skillsOf(profile), `c${changes.length + 1}`);
  if (skills) changes.push(skills);

  const resume = applyChanges(base, changes);
  return saveTailored(deps.env, request.userId, {
    postingId: posting.id,
    title: posting.title,
    company: posting.company,
    base,
    resume,
    changes,
    match: matchSummary(base, resume, requirements),
    editedByHand: false,
  });
}
