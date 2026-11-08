import type { Profile } from "../memory/profile/types";
import { fieldsOf } from "./fields";
import type { FeedCriteria } from "./types";

const MAX_ROLES = 3;
const MAX_SKILLS = 12;

// the profile has no location field yet; a string one is used as soon as it does
function locationOf(profile: Profile) {
  const value = (profile as Profile & { location?: unknown }).location;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// target roles first; without them the most recent job title stands in, so a half-filled profile still gets a feed
export function criteriaFrom(profile: Profile, avoidTags: string[] = []): FeedCriteria {
  const roles = profile.targetRoles.length > 0 ? profile.targetRoles : profile.experience.slice(0, 1).map((e) => e.role);
  return {
    roles: roles.map((r) => r.trim()).filter(Boolean).slice(0, MAX_ROLES),
    skills: profile.skills.map((s) => s.name.trim()).filter(Boolean).slice(0, MAX_SKILLS),
    location: locationOf(profile),
    fields: fieldsOf(profile),
    avoidTags,
  };
}

// one job search per role; with no roles, the top skills make one search so the feed is never empty for lack of a goal
export function jobQueries(criteria: FeedCriteria) {
  const terms = criteria.roles.length > 0 ? criteria.roles : criteria.skills.length > 0 ? [criteria.skills.slice(0, 2).join(" ")] : [];
  return terms.map((what) => ({ what, where: criteria.location }));
}
