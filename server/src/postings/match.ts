import type { Profile } from "../memory/profile/types";
import { containsQuote } from "../recommend/verify";
import { backgroundOf } from "../roadmap/background";
import type { PostingRequirement } from "./types";

/** A requirement as the model drafted it: its evidence is a claim until `markRequirements` has checked it. */
export type DraftRequirement = { text: string; topic: string; required: boolean; evidence?: string };

// the model never decides "have": it may quote the profile, and the quote has to really be there, like the recommend
// skills' evidence; failing that, a skill the person listed by name inside the requirement counts as proof
export function markRequirements(drafts: DraftRequirement[], profile: Profile): PostingRequirement[] {
  const background = backgroundOf(profile);
  const skillNames = profile.skills.map((s) => s.name.trim()).filter(Boolean);
  return drafts.map((draft) => {
    const quoted = draft.evidence !== undefined && containsQuote(background, draft.evidence);
    const named = skillNames.find((name) => containsQuote(draft.text, name) || containsQuote(draft.topic, name));
    const requirement: PostingRequirement = { text: draft.text, topic: draft.topic, required: draft.required, have: quoted || named !== undefined };
    if (quoted) requirement.evidence = draft.evidence;
    else if (named) requirement.evidence = `Skill: ${named}`;
    return requirement;
  });
}

export const missingRequirements = (requirements: PostingRequirement[]) =>
  // what the posting insists on comes first, so the roadmap steps cover the gaps that matter most
  [...requirements.filter((r) => !r.have && r.required), ...requirements.filter((r) => !r.have && !r.required)];

export const haveCount = (requirements: PostingRequirement[]) => requirements.filter((r) => r.have).length;
