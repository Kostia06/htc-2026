import type { TemplateUnit } from "./types";

// works for any field: trades, hospitality, public service, or someone still deciding
export const generalUnits: TemplateUnit[] = [
  {
    title: "Find your way in",
    summary: "Learn what the job asks for from people who do it.",
    steps: [
      { kind: "networking", title: "Talk to one person who does the job", why: (g) => `They know which first step really leads to ${g}.`, estimate: "1 hour", label: "ready_now" },
      { kind: "course", title: "Read three postings and list what they ask for", why: (g) => `It turns "${g}" into a checklist you can work through.`, estimate: "1 hour", label: "ready_now" },
      { kind: "event", title: "Go to one job fair or open house", why: (g) => `Employers hiring for ${g} meet people there first.`, estimate: "1 day", label: "ready_now" },
      { kind: "certification", title: "Earn the most-requested entry certificate", why: (g) => `It's often the gate for a ${g} role.`, estimate: "4 weeks", label: "stretch" },
    ],
  },
  {
    title: "Build a track record",
    summary: "Show up, help out, and keep proof.",
    steps: [
      { kind: "volunteering", title: "Volunteer somewhere close to the work", why: (g) => `Real hours near ${g} work count with employers.`, estimate: "6 weeks", label: "stretch" },
      { kind: "project", title: "Do one small job or project you can show", why: () => "Something you can point to beats a promise.", estimate: "2 weekends", label: "stretch" },
      { kind: "networking", title: "Ask someone to mentor you for a month", why: (g) => `A mentor in ${g} spots the shortcuts.`, estimate: "4 weeks", label: "stretch" },
      { kind: "course", title: "Take one short course on a skill postings ask for", why: (g) => `It fills a gap between you and ${g}.`, estimate: "4 weeks", label: "long_term" },
    ],
  },
];

// after a field's own units run out, these keep the path going
export const momentumUnits: TemplateUnit[] = [
  {
    title: "Keep the momentum",
    summary: "Steady weekly steps add up.",
    steps: [
      { kind: "application", title: "Send three tailored applications", why: (g) => `Steady applications are how ${g} offers happen.`, estimate: "1 week", label: "stretch" },
      { kind: "interview_practice", title: "Run one mock interview", why: (g) => `Each rep makes the real ${g} interview calmer.`, estimate: "1 hour", label: "ready_now" },
      { kind: "networking", title: "Reconnect with two people from your path", why: () => "Most referrals come from people you already know.", estimate: "30 min", label: "ready_now" },
    ],
  },
  {
    title: "Level up",
    summary: "Raise the bar on what you can show.",
    steps: [
      { kind: "project", title: "Take on a bigger project than your last", why: (g) => `Growth is what a ${g} hiring manager looks for.`, estimate: "4 weeks", label: "stretch" },
      { kind: "certification", title: "Go one level deeper in a credential", why: (g) => `It sets you apart from other ${g} applicants.`, estimate: "8 weeks", label: "long_term" },
      { kind: "event", title: "Give a short talk or demo of your work", why: () => "Teaching what you did proves you understand it.", estimate: "1 evening", label: "stretch" },
    ],
  },
];
