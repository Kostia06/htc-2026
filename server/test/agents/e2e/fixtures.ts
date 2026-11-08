import { emptyResume } from "../../../src/resume/types";

// one valid input and one valid finish payload per registered skill, so the suite can drive every skill end to end
export type SkillFixture = { input: Record<string, unknown>; output: Record<string, unknown> };

const resume = { ...emptyResume(), summary: "Built a small booking app for a campus club." };
const chat = [{ role: "user", text: "I finished my portfolio site." }];
const question = (text: string) => ({ text, why: "It comes up often.", reported: false });

export const fixtures: Record<string, SkillFixture> = {
  "profile-intake": { input: { text: "Student at SAIT, likes data.", source: "self-reported" }, output: { summary: "A SAIT student.", missing: [] } },
  "onboarding-prefill": { input: { text: "Jane, SAIT, Python." }, output: { targetRoles: [], skills: [] } },
  "resume-coach": { input: { resume, targetRole: "junior developer" }, output: { suggestions: [] } },
  "resume-tailor": {
    input: { resume, requirements: [{ text: "React", topic: "react", required: true }], title: "Developer", companyName: "Acme" },
    output: { changes: [] },
  },
  "github-projects": { input: { repos: [] }, output: { projects: [] } },
  "linkedin-review": { input: { text: "Headline: student" }, output: { suggestions: [] } },
  "research-company": { input: { company: "acme" }, output: { summary: "Nothing new." } },
  "interview-prep": {
    input: { company: "acme", role: "developer" },
    output: { questions: ["a", "b", "c", "d", "e"].map((q) => question(`Question ${q}?`)), focus: ["stories"] },
  },
  "interview-intel": { input: { company: "acme" }, output: { summary: "No public process yet.", stages: [] } },
  "interview-debrief": {
    input: { answers: [{ question: "Tell me about yourself.", answer: "I study at SAIT.", score: 3 }] },
    output: { summary: "Solid start.", prepList: [] },
  },
  "interview-recap": { input: { messages: chat, questionsLeft: 2 }, output: { done: false, reply: "What did they ask?", extracted: { questions: [] } } },
  "career-snapshot": { input: {}, output: { targetRoles: ["Junior developer"], nextSteps: [] } },
  "recommend-jobs": { input: {}, output: { person: { job_zone: 2, experience: [] }, items: [] } },
  "recommend-courses": { input: {}, output: { items: [] } },
  "recommend-research": { input: {}, output: { items: [] } },
  "roadmap-steps": {
    input: { goal: "junior developer", count: 1 },
    output: { steps: [{ kind: "project", title: "Build one API", why: "No projects yet.", detail: "A small REST API.", estimate: "2 weeks", needs: [] }] },
  },
  "quick-update": {
    input: { messages: chat, steps: [], skills: [], targetRoles: [], projects: [], canAsk: true },
    output: { reply: "Nice work.", needsAnswer: false, actions: [] },
  },
  "import-posting": {
    input: { text: "Junior Developer at Acme. Requires React." },
    output: { title: "Junior Developer", company: "Acme", requirements: [], responsibilities: [], skills: [] },
  },
  "crossroads-ask": {
    input: { messages: chat, canAsk: true, goal: "developer", you: [], everyone: [], trails: [], research: [], links: [] },
    output: { reply: "Keep going.", needsAnswer: false, cites: [] },
  },
};
