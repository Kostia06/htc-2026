import type { Assessment, Counts, Gap, Level, Match, Requirement } from "./types";

// design choices from the research, not from any study; tune with user testing
const READY_MET_SHARE = 0.8;
const STRETCH_MET_SHARE = 0.5;
const MAX_STRETCH_MISSING = 2;
const MAX_UNKNOWN_SHARE = 0.3;
const MAX_STRETCH_YEARS_GAP = 1;
const MAX_STRETCH_ZONE_GAP = 1;
const PROJECT_YEARS = 0.5;

export type FitInput = {
  requirements: Requirement[];
  experienceGapYears: number;
  // O*NET Job Zones, 1 (little preparation) to 5 (graduate school)
  jobZone: { role: number; person: number };
  separatesRequired: boolean;
};

export function experienceGap(requiredYears: number, has: { workYears: number; projects: number }) {
  return Math.max(0, requiredYears - has.workYears - has.projects * PROJECT_YEARS);
}

const years = (n: number) => `${Math.round(n * 10) / 10} years`;
const gapOf = (r: Requirement): Gap => ({ requirement: r.quote, kind: r.kind });
const isMustHave = (r: Requirement) => r.kind !== "preferred";

// the model never picks the level: it only extracts quotes, and this decides
export function assessFit(input: FitInput): Assessment {
  // without a required/preferred split we can't tell which items gate, so all of them count
  const requirements = input.separatesRequired ? input.requirements : input.requirements.map((r) => ({ ...r, kind: r.kind === "preferred" ? "required" : r.kind }) as Requirement);
  const mustHaves = requirements.filter(isMustHave);
  const described = describe(requirements);
  const decide = (level: Level, reasons: string[]) => ({ ...described, level, reasons: [countsSentence(described.counts), ...reasons] });

  if (requirements.length === 0) return decide("cant_tell", ["I couldn't confirm any requirement on the page, so I can't judge this yet."]);

  const missing = mustHaves.filter((r) => r.met === "no");
  const unknown = mustHaves.filter((r) => r.met === "unknown");
  const zoneGap = input.jobZone.role - input.jobZone.person;
  const yearsGap = input.experienceGapYears;

  const blockers = [
    ...requirements.filter((r) => r.kind === "hard" && r.met === "no").map((r) => `They require "${r.quote}", and your profile doesn't show it.`),
    ...(yearsGap > MAX_STRETCH_YEARS_GAP ? [`You're about ${years(yearsGap)} short of the experience they ask for.`] : []),
    ...(zoneGap > MAX_STRETCH_ZONE_GAP ? [`This role needs much more preparation than you have now (job zone ${input.jobZone.role}, you are at ${input.jobZone.person}).`] : []),
    ...(missing.length > MAX_STRETCH_MISSING ? [`You're missing ${missing.length} of the required items.`] : []),
  ];
  // checked before unknowns: a question is only worth asking if the answer could change the level
  if (blockers.length) return decide("long_term", blockers);

  const unknownHard = unknown.filter((r) => r.kind === "hard");
  if (unknownHard.length) return decide("cant_tell", [`I can't judge this until I know whether you meet: ${unknownHard.map((r) => `"${r.quote}"`).join(", ")}.`]);
  if (unknown.length / mustHaves.length > MAX_UNKNOWN_SHARE) return decide("cant_tell", ["Your profile is silent on too many of the required items for me to judge this."]);

  const metShare = mustHaves.length ? described.counts.required_met / mustHaves.length : 1;
  if (metShare < STRETCH_MET_SHARE) return decide("long_term", ["You meet fewer than half of the required items."]);

  const shortfalls = [
    ...(missing.length ? [`You're missing ${missing.length === 1 ? "one required item" : `${missing.length} required items`}.`] : []),
    ...(yearsGap > 0 ? [`You're about ${years(yearsGap)} short of the experience they ask for.`] : []),
    ...(zoneGap > 0 ? ["This role usually needs a bit more preparation than you have now."] : []),
    ...(metShare < READY_MET_SHARE ? ["Your profile doesn't show enough of the required items yet."] : []),
  ];
  const result = shortfalls.length ? decide("stretch", shortfalls) : decide("ready_now", []);
  return input.separatesRequired ? result : capAtStretch(result, "The posting doesn't say which items are required, so I can't call this ready.");
}

export function capAtStretch(assessment: Assessment, reason: string): Assessment {
  if (assessment.level !== "ready_now") return assessment;
  return { ...assessment, level: "stretch", reasons: [...assessment.reasons, reason] };
}

function describe(requirements: Requirement[]): Omit<Assessment, "level" | "reasons"> {
  const mustHaves = requirements.filter(isMustHave);
  const preferred = requirements.filter((r) => !isMustHave(r));
  const metCount = (list: Requirement[]) => list.filter((r) => r.met === "yes").length;
  const counts: Counts = {
    required_met: metCount(mustHaves),
    required_total: mustHaves.length,
    preferred_met: metCount(preferred),
    preferred_total: preferred.length,
    summary: `${metCount(mustHaves)} of ${mustHaves.length} required`,
  };
  const matched: Match[] = requirements.flatMap((r) => (r.met === "yes" && r.evidence ? [{ requirement: r.quote, evidence: r.evidence }] : []));
  return {
    counts,
    matched,
    missing: requirements.filter((r) => r.met === "no").map(gapOf),
    unknown: requirements.filter((r) => r.met === "unknown").map(gapOf),
  };
}

const countsSentence = (c: Counts) => `You meet ${c.required_met} of ${c.required_total} required items.`;
