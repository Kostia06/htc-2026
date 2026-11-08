import type { FeedCard, FeedKind, RankedSection } from "./types";

const FOR_YOU_CAP = 60;
const SECTION_CAP = 40;
const MAX_RUN = 2;

const KIND_OF: Record<Exclude<RankedSection, "all">, FeedKind> = { jobs: "job", events: "event", hackathons: "hackathon", courses: "course" };

// For you mixes kinds so three jobs never bury the one event that fits; the per-kind sections keep pure rank order
export function sectionsFrom(ranked: FeedCard[]): Record<RankedSection, FeedCard[]> {
  const ofKind = (kind: FeedKind) => ranked.filter((card) => card.kind === kind).slice(0, SECTION_CAP);
  return {
    all: diversify(ranked, MAX_RUN).slice(0, FOR_YOU_CAP),
    jobs: ofKind(KIND_OF.jobs),
    events: ofKind(KIND_OF.events),
    hackathons: ofKind(KIND_OF.hackathons),
    courses: ofKind(KIND_OF.courses),
  };
}

// keeps rank order except that a run of one kind longer than maxRun is broken by the next best card of another kind
export function diversify(ranked: FeedCard[], maxRun: number): FeedCard[] {
  const waiting = [...ranked];
  const out: FeedCard[] = [];
  while (waiting.length > 0) {
    const last = out.at(-1)?.kind;
    const run = last === undefined ? 0 : out.length - out.findLastIndex((card) => card.kind !== last) - 1;
    const other = run >= maxRun ? waiting.findIndex((card) => card.kind !== last) : 0;
    out.push(...waiting.splice(other < 0 ? 0 : other, 1));
  }
  return out;
}
