import type { TemplateUnit } from "./types";

export const businessUnits: TemplateUnit[] = [
  {
    title: "Learn how the work really works",
    summary: "Talk to people in the role before you aim your resume at it.",
    steps: [
      { kind: "networking", title: "Book two coffee chats with people in the role", why: (g) => `They'll tell you what a ${g} actually spends the day on.`, estimate: "2 hours", label: "ready_now" },
      { kind: "course", title: "Take a short Excel or analytics course", why: (g) => `Almost every ${g} posting asks for comfort with numbers.`, estimate: "3 weeks", label: "stretch" },
      { kind: "event", title: "Attend one industry or alumni event", why: (g) => `${g} roles are often filled through referrals.`, estimate: "1 evening", label: "ready_now" },
      { kind: "project", title: "Write a one-page analysis of a company you like", why: (g) => `It shows a ${g} interviewer how you think.`, estimate: "1 weekend", label: "ready_now" },
    ],
  },
  {
    title: "Build real experience",
    summary: "Small, real results beat big plans.",
    steps: [
      { kind: "volunteering", title: "Run one project for a club or non-profit", why: (g) => `Leading something real is the experience a ${g} is hired for.`, estimate: "4 weeks", label: "stretch" },
      { kind: "hackathon", title: "Join a case competition or business hackathon", why: (g) => `It's the fastest way to pitch like a ${g}.`, estimate: "1 weekend", label: "stretch" },
      { kind: "certification", title: "Earn a recognised entry certificate", why: (g) => `It gives your ${g} resume a line recruiters search for.`, estimate: "6 weeks", label: "long_term" },
      { kind: "networking", title: "Follow up with everyone you met so far", why: () => "A short thank-you turns a chat into a referral later.", estimate: "30 min", label: "ready_now" },
    ],
  },
  {
    title: "Go for it",
    summary: "Apply where your story fits and rehearse it.",
    steps: [
      { kind: "interview_practice", title: "Practise three behavioural answers out loud", why: (g) => `${g} interviews lean on "tell me about a time".`, estimate: "1 hour", label: "ready_now" },
      { kind: "application", title: "Apply to five roles with a tailored cover note", why: (g) => `Tailored ${g} applications get far more replies.`, estimate: "1 week", label: "stretch" },
      { kind: "interview_practice", title: "Do one mock case or role-play interview", why: () => "Thinking out loud with numbers takes practice.", estimate: "1 hour", label: "stretch" },
      { kind: "application", title: "Ask a contact for one referral", why: (g) => `A referral moves a ${g} application to the top of the pile.`, estimate: "1 week", label: "long_term" },
    ],
  },
];
