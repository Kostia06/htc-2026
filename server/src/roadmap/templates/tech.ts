import type { TemplateUnit } from "./types";

export const techUnits: TemplateUnit[] = [
  {
    title: "Show what you can build",
    summary: "One finished project says more than a list of skills.",
    steps: [
      { kind: "project", title: "Ship one small project end to end", why: (g) => `${g} interviews start from what you've built.`, estimate: "2 weekends", label: "ready_now" },
      { kind: "networking", title: "Ask one person in the role for 15 minutes", why: (g) => `Hearing a real ${g}'s week tells you what to learn first.`, estimate: "1 hour", label: "ready_now" },
      { kind: "course", title: "Finish one focused course on your weakest tool", why: (g) => `Close the gap a ${g} posting asks for most.`, estimate: "3 weeks", label: "stretch" },
      { kind: "event", title: "Go to one local tech meetup", why: (g) => `Many ${g} jobs are filled through people, not postings.`, estimate: "1 evening", label: "ready_now" },
    ],
  },
  {
    title: "Get seen",
    summary: "Put your work where hiring teams can find it.",
    steps: [
      { kind: "hackathon", title: "Build something at a weekend hackathon", why: (g) => `A team build under a deadline is the closest thing to a ${g} job.`, estimate: "1 weekend", label: "stretch" },
      { kind: "project", title: "Write a short case study of your project", why: (g) => `It gives a ${g} interviewer a story to ask about.`, estimate: "2 hours", label: "ready_now" },
      { kind: "volunteering", title: "Help a non-profit with a small tech task", why: (g) => `Real users make your ${g} experience count.`, estimate: "4 weeks", label: "stretch" },
      { kind: "networking", title: "Comment on or contribute to one open-source issue", why: () => "Public code review is proof you can work on a team.", estimate: "1 week", label: "stretch" },
    ],
  },
  {
    title: "Go for it",
    summary: "Apply with a story and practise telling it.",
    steps: [
      { kind: "interview_practice", title: "Do two mock technical interviews", why: (g) => `${g} loops reward thinking out loud, which takes practice.`, estimate: "2 hours", label: "stretch" },
      { kind: "application", title: "Apply to five roles that match your projects", why: (g) => `Five tailored ${g} applications beat fifty generic ones.`, estimate: "1 week", label: "stretch" },
      { kind: "certification", title: "Earn one cloud or tool certification", why: (g) => `It's a quick filter many ${g} postings use.`, estimate: "6 weeks", label: "long_term" },
      { kind: "interview_practice", title: "Practise your project walkthrough out loud", why: () => "You'll be asked to explain a decision you made.", estimate: "30 min", label: "ready_now" },
    ],
  },
];
