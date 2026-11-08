import type { TemplateUnit } from "./types";

export const healthUnits: TemplateUnit[] = [
  {
    title: "Know the path",
    summary: "Health careers have gates; find yours first.",
    steps: [
      { kind: "networking", title: "Talk to one person already working in the role", why: (g) => `They'll tell you what a ${g} needs that the website doesn't.`, estimate: "1 hour", label: "ready_now" },
      { kind: "course", title: "List the licences and prerequisites you need", why: (g) => `Every ${g} path has required steps; know them up front.`, estimate: "2 hours", label: "ready_now" },
      { kind: "certification", title: "Get CPR and first aid certified", why: (g) => `Most ${g} roles and placements ask for it.`, estimate: "1 day", label: "ready_now" },
      { kind: "event", title: "Attend one info session or open house", why: () => "Programs and employers explain what they look for.", estimate: "1 evening", label: "ready_now" },
    ],
  },
  {
    title: "Get hands-on",
    summary: "Patient-facing hours count for a lot.",
    steps: [
      { kind: "volunteering", title: "Volunteer at a clinic, hospital or care home", why: (g) => `Care hours show you're ready to be a ${g}.`, estimate: "8 weeks", label: "stretch" },
      { kind: "networking", title: "Ask to shadow someone for a shift", why: (g) => `Seeing a ${g}'s shift tells you if it fits.`, estimate: "1 day", label: "stretch" },
      { kind: "course", title: "Take one course you're still missing", why: (g) => `It clears a gate on the way to ${g}.`, estimate: "1 term", label: "long_term" },
      { kind: "project", title: "Keep a log of your hours and what you learned", why: () => "Applications ask for specifics, and memory fades.", estimate: "10 min a week", label: "ready_now" },
    ],
  },
  {
    title: "Go for it",
    summary: "Apply with your hours and your why.",
    steps: [
      { kind: "interview_practice", title: "Practise your 'why this field' answer", why: (g) => `Every ${g} interview starts there.`, estimate: "30 min", label: "ready_now" },
      { kind: "application", title: "Apply to programs or entry roles", why: (g) => `It's the step that turns preparation into ${g}.`, estimate: "2 weeks", label: "stretch" },
      { kind: "interview_practice", title: "Do one mock scenario interview", why: () => "Situational questions are common and easy to practise.", estimate: "1 hour", label: "stretch" },
      { kind: "application", title: "Ask a supervisor for a reference", why: () => "A reference from your volunteer hours carries weight.", estimate: "1 week", label: "long_term" },
    ],
  },
];
