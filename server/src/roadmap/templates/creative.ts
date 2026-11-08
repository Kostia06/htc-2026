import type { TemplateUnit } from "./types";

export const creativeUnits: TemplateUnit[] = [
  {
    title: "Make your best work visible",
    summary: "A small, sharp portfolio opens more doors than a big one.",
    steps: [
      { kind: "project", title: "Pick your three strongest pieces", why: (g) => `A ${g} is hired on what people can see.`, estimate: "1 evening", label: "ready_now" },
      { kind: "project", title: "Put them on one simple portfolio page", why: (g) => `Every ${g} application will ask for a link.`, estimate: "1 weekend", label: "ready_now" },
      { kind: "networking", title: "Ask one working artist for a portfolio review", why: (g) => `Honest feedback from a ${g} saves months of guessing.`, estimate: "1 hour", label: "stretch" },
      { kind: "event", title: "Go to one gallery night, show or meetup", why: () => "Creative work is often found through people you've met.", estimate: "1 evening", label: "ready_now" },
    ],
  },
  {
    title: "Work for real people",
    summary: "Briefs and deadlines turn practice into experience.",
    steps: [
      { kind: "volunteering", title: "Take on one brief for a local cause", why: (g) => `A real client makes your ${g} portfolio believable.`, estimate: "4 weeks", label: "stretch" },
      { kind: "hackathon", title: "Join a game jam or design sprint", why: (g) => `It shows you can ship as a ${g} on a deadline.`, estimate: "1 weekend", label: "stretch" },
      { kind: "course", title: "Learn one industry-standard tool deeply", why: (g) => `Studios hiring a ${g} filter on the tools you know.`, estimate: "4 weeks", label: "stretch" },
      { kind: "project", title: "Write the story behind one piece", why: () => "Process is what interviewers ask about.", estimate: "2 hours", label: "ready_now" },
    ],
  },
  {
    title: "Go for it",
    summary: "Pitch yourself to the places you want to work.",
    steps: [
      { kind: "application", title: "Send your portfolio to five studios or clients", why: (g) => `A ${g} career usually starts with a few direct asks.`, estimate: "1 week", label: "stretch" },
      { kind: "interview_practice", title: "Practise walking through your portfolio", why: () => "Five minutes, three pieces, one clear story each.", estimate: "1 hour", label: "ready_now" },
      { kind: "event", title: "Enter one juried show or competition", why: (g) => `Recognition gives a ${g} resume a headline.`, estimate: "6 weeks", label: "long_term" },
      { kind: "networking", title: "Follow up with everyone who saw your work", why: () => "People hire the artist they remember.", estimate: "30 min", label: "ready_now" },
    ],
  },
];
