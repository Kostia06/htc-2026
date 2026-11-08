import type { Candidate, FeedCard, FeedCriteria } from "./types";

const DAY_MS = 86_400_000;
const MAX_SKILLS_COUNTED = 3;
const WEIGHT = { role: 3, skill: 1, location: 2, week: 1, month: 0.5 };

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

const listed = (names: string[]) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

function ageInDays(postedAt: string | undefined, now: Date) {
  const time = postedAt ? Date.parse(postedAt) : Number.NaN;
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : (now.getTime() - time) / DAY_MS;
}

function score(candidate: Candidate, criteria: FeedCriteria, now: Date) {
  const role = matchingRole(candidate.card.title, criteria.roles);
  const skills = criteria.skills.filter((s) => mentions(candidate.text, s)).slice(0, MAX_SKILLS_COUNTED);
  const near = criteria.location !== undefined && (candidate.card.where ?? "").toLowerCase().includes(criteria.location.toLowerCase());
  const age = ageInDays(candidate.postedAt, now);

  let points = skills.length * WEIGHT.skill;
  if (role) points += WEIGHT.role;
  if (near) points += WEIGHT.location;
  if (age <= 7) points += WEIGHT.week;
  else if (age <= 30) points += WEIGHT.month;

  const why = role
    ? `Fits your goal: ${role}`
    : skills.length > 0
      ? `Uses ${listed(skills)} from your profile`
      : near
        ? `Near you in ${criteria.location}`
        : age <= 7
          ? "Posted this week"
          : "Open to apply";
  return { points, why, age };
}

export function rankCandidates(candidates: Candidate[], criteria: FeedCriteria, now: Date): FeedCard[] {
  const seen = new Set<string>();
  const unique = candidates.filter((c) => !seen.has(c.card.url) && seen.add(c.card.url));
  return unique
    .map((candidate) => ({ candidate, ...score(candidate, criteria, now) }))
    .sort((a, b) => b.points - a.points || a.age - b.age)
    .map(({ candidate, why }) => ({ ...candidate.card, why }));
}
