import type { TemplateStep } from "./types";

// works for any field: trades, hospitality, public service, or someone still deciding
export const generalSteps: TemplateStep[] = [
  {
    kind: "networking_practice",
    title: (p) => `Practise asking a ${p.goal} how they got in`,
    why: () => "They know which first step really leads there.",
    detail: () => "Rehearse out loud: who you are, what you're aiming for, and one question about their first job.",
    estimate: "20 min",
    needs: [],
  },
  {
    kind: "course",
    title: (p) => `Turn three ${p.goal} postings into a checklist`,
    why: () => "It turns a job title into things you can actually do this month.",
    detail: () => "Open three postings, list every requirement, and mark each one have / can get / need to ask about.",
    estimate: "1 hour",
    needs: [],
  },
  {
    kind: "event",
    title: () => "Go to one job fair or open house",
    why: (p) => `Employers hiring for ${p.goal} roles meet people there first.`,
    detail: () => "Bring a printed resume, talk to three employers, and write down who said to follow up.",
    estimate: "1 day",
    needs: [],
  },
  {
    kind: "certification",
    title: () => "Earn the most-requested entry certificate",
    why: (p) => `It's often the gate for a ${p.goal} role.`,
    detail: () => "Take the one that showed up on your checklist most often and book the date this week.",
    estimate: "4 weeks",
    needs: ["certificate"],
  },
  {
    kind: "volunteering",
    title: () => "Volunteer somewhere close to the work",
    why: () => "Real hours near the job count with employers.",
    detail: () => "Find a group doing similar work, commit to one shift a week, and keep a log of dates and tasks.",
    estimate: "6 weeks",
    needs: [],
  },
  {
    kind: "interview_practice",
    title: (p) => `Mock ${p.goal} interview: why this job`,
    why: () => "The first question is always some version of it.",
    detail: () => "Answer out loud in under a minute: what drew you in, what you've done about it, and what you want to learn.",
    estimate: "15 min",
    needs: [],
  },
];

// once a field's own steps are used up, these keep the path going for as long as the person scrolls
export const momentumSteps: TemplateStep[] = [
  {
    kind: "application",
    title: () => "Send three tailored applications",
    why: (p) => `Steady applications are how ${p.goal} offers happen.`,
    detail: () => "Three postings, three resume tweaks that echo their words, sent before the weekend.",
    estimate: "1 week",
    needs: ["resume"],
  },
  {
    kind: "interview_practice",
    title: () => "Run one more mock interview",
    why: (p) => `Each rep makes the real ${p.goal} interview calmer.`,
    detail: () => "Pick the question you dodged last time and answer it first.",
    estimate: "15 min",
    needs: [],
  },
  {
    kind: "networking_practice",
    title: () => "Practise a follow-up with someone you met",
    why: () => "Most referrals come from a second conversation, not the first.",
    detail: () => "Rehearse a short check-in: what you did since you met, and one small ask.",
    estimate: "15 min",
    needs: [],
  },
  {
    kind: "project",
    title: () => "Take on a bigger project than your last",
    why: (p) => `Growth is what a ${p.goal} hiring manager looks for.`,
    detail: () => "Double the scope of your last project in one way only: more users, more data, or a real deadline.",
    estimate: "4 weeks",
    needs: [],
  },
  {
    kind: "event",
    title: () => "Give a short talk or demo of your work",
    why: () => "Teaching what you did proves you understand it.",
    detail: () => "Five minutes at a meetup, class or team meeting; one slide, one demo, one lesson.",
    estimate: "1 evening",
    needs: ["public speaking"],
  },
  {
    kind: "certification",
    title: () => "Go one level deeper in a credential",
    why: (p) => `It sets you apart from other ${p.goal} applicants.`,
    detail: () => "Take the next level of the certificate you already hold, or the one your field respects most.",
    estimate: "8 weeks",
    needs: ["certificate"],
  },
];
