import { reasonsFor } from "./reasons";
import type { Candidate, FeedCard, FeedCriteria, FeedField, FeedKind } from "./types";

const DAY_MS = 86_400_000;
const MAX_SKILLS_COUNTED = 3;
const MAX_AVOIDED_COUNTED = 2;
const SOON_DAYS = 14;
const UPCOMING_DAYS = 45;
const WEIGHT = { role: 3, skill: 1, field: 2, general: 1, location: 2, soon: 1, upcoming: 0.5, week: 1, month: 0.5, avoided: -2 };

const FALLBACK_WHY: Record<FeedKind, string> = { job: "Open to apply", course: "Free, start any time", event: "Open to everyone", hackathon: "Open to everyone" };

const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9+#]+/g) ?? [];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// every meaningful word of the role appears in the title: "Junior developer" fits "Junior Software Developer"
function matchingRole(title: string, roles: string[]) {
  const titleWords = new Set(wordsOf(title));
  return roles.find((role) => {
    const words = wordsOf(role).filter((w) => w.length > 2);
    return words.length > 0 && words.every((w) => titleWords.has(w));
  });
}

// whole words only, so "Java" doesn't match "JavaScript"; "+" and "#" count as word characters for C++ and C#
const mentions = (text: string, skill: string) => new RegExp(`(^|[^a-z0-9+#])${escape(skill.toLowerCase())}($|[^a-z0-9+#])`).test(text.toLowerCase());

// the person's own field wins; an item open to any field counts a little for everyone
function matchingField(candidate: Candidate, criteria: FeedCriteria): FeedField | undefined {
  const mine = new Set<FeedField>((criteria.fields ?? []).filter((f) => f !== "general"));
  const theirs = candidate.fields ?? [];
  return theirs.find((f) => mine.has(f)) ?? (theirs.includes("general") ? "general" : undefined);
}

function daysFrom(now: Date, iso: string | undefined) {
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(time) ? undefined : (time - now.getTime()) / DAY_MS;
}

function score(candidate: Candidate, criteria: FeedCriteria, now: Date) {
  const role = matchingRole(candidate.card.title, criteria.roles);
  const skills = criteria.skills.filter((s) => mentions(candidate.text, s)).slice(0, MAX_SKILLS_COUNTED);
  const field = matchingField(candidate, criteria);
  const near = criteria.location !== undefined && (candidate.card.where ?? "").toLowerCase().includes(criteria.location.toLowerCase());
  const tags = candidate.card.tags ?? [];
  const avoided = (criteria.avoidTags ?? []).filter((t) => tags.includes(t)).slice(0, MAX_AVOIDED_COUNTED);
  const age = -(daysFrom(now, candidate.postedAt) ?? Number.NEGATIVE_INFINITY);
  const until = daysFrom(now, candidate.startsAt);

  let points = skills.length * WEIGHT.skill + avoided.length * WEIGHT.avoided;
  if (role) points += WEIGHT.role;
  if (field) points += field === "general" ? WEIGHT.general : WEIGHT.field;
  if (near) points += WEIGHT.location;
  if (until !== undefined && until <= SOON_DAYS) points += WEIGHT.soon;
  else if (until !== undefined && until <= UPCOMING_DAYS) points += WEIGHT.upcoming;
  if (age <= 7) points += WEIGHT.week;
  else if (age <= 30) points += WEIGHT.month;

  const reasons = reasonsFor(candidate, criteria, { role, skills, field, near, daysUntil: until, upcomingDays: UPCOMING_DAYS });
  // with nothing personal to say, the line says something true about the item instead
  const why = reasons[0] ?? (age <= 7 ? "Posted this week" : FALLBACK_WHY[candidate.card.kind]);
  // ties go to whatever is soonest or freshest
  return { points, why, reasons, order: until ?? age };
}

export function rankCandidates(candidates: Candidate[], criteria: FeedCriteria, now: Date): FeedCard[] {
  const seen = new Set<string>();
  const unique = candidates.filter((c) => !seen.has(c.card.url) && seen.add(c.card.url));
  return unique
    .map((candidate) => ({ candidate, ...score(candidate, criteria, now) }))
    .sort((a, b) => b.points - a.points || a.order - b.order || 0)
    .map(({ candidate, why, reasons }) => ({ ...candidate.card, why, reasons }));
}
