import type { Account } from "../auth/account";
import type { Profile } from "../memory/profile/types";
import { seedFromProfile } from "./parse";
import type { Resume } from "./types";

const LOOKING_IN = /^Looking in:\s*(.+)$/i;

// onboarding saves "where are you looking?" as a goal line; "Remote" says nothing about where the person is
export function locationFromProfile(profile: Profile): string {
  const stated = (profile as Profile & { location?: unknown }).location;
  if (typeof stated === "string" && stated.trim()) return stated.trim();
  const answer = profile.goals.map((goal) => LOOKING_IN.exec(goal.trim())?.[1]?.trim()).find(Boolean);
  if (!answer || /^remote$/i.test(answer)) return "";
  return answer.replace(/^anywhere in\s+/i, "");
}

const orElse = (typed: string, known: string | undefined) => (typed.trim() ? typed : (known ?? ""));
const listOrElse = <T>(typed: T[], known: T[]) => (typed.length ? typed : known);

/**
 * Fills every blank of a resume from what Skillit already knows: the account for name, email and phone, the profile for
 * location, headline, education, experience, projects and skills. Anything the person typed wins, field by field and
 * section by section; nothing is written, so the fill follows the profile until the person sets the field themselves.
 */
export function prefillResume(resume: Resume, profile: Profile, account: Account | undefined): Resume {
  const known = seedFromProfile(profile);
  const { contact } = resume;
  return {
    ...resume,
    contact: {
      name: orElse(contact.name, account?.name),
      email: orElse(contact.email, account?.email),
      phone: orElse(contact.phone, account?.phone),
      location: orElse(contact.location, locationFromProfile(profile)),
      links: contact.links,
    },
    summary: orElse(resume.summary, known.summary),
    experience: listOrElse(resume.experience, known.experience),
    education: listOrElse(resume.education, known.education),
    projects: listOrElse(resume.projects, known.projects),
    skills: listOrElse(resume.skills, known.skills),
  };
}
