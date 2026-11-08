import { describe, expect, it } from "vitest";
import { emptyProfile } from "../../src/memory/profile/patch";
import { buildInterviewPlan, MAX_QUESTIONS, MAX_WORDS } from "../../src/voice/plan";
import { inputs, profile } from "./fixtures";

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe("interview plan", () => {
  it("opens with the person's own resume, then what people reported, then their field", () => {
    const plan = buildInterviewPlan(inputs());
    expect(plan.questions.map((q) => q.source)).toEqual(["resume", "resume", "reported", "technical", "technical"]);
    expect(plan.questions.length).toBeLessThanOrEqual(MAX_QUESTIONS);
  });

  it("asks about the posting after the resume: what they'd do, what they bring, then the gap", () => {
    const posting = {
      requirements: [{ text: "Kubernetes", have: false }, { text: "SQL", have: true }],
      responsibilities: ["Build dashboards for the lending team.", "Clean and load data"],
    };
    const plan = buildInterviewPlan(inputs({ posting }));
    expect(plan.questions.map((q) => q.source)).toEqual(["resume", "resume", "posting", "posting", "reported"]);
    expect(plan.questions[2].text).toBe("Here you'd build dashboards for the lending team. When have you done something like that?");
    expect(plan.questions[3].text).toBe("Here you'd clean and load data. When have you done something like that?");
    const gaps = buildInterviewPlan(inputs({ posting: { ...posting, responsibilities: [] } })).questions.filter((q) => q.source === "posting");
    expect(gaps.map((q) => q.text)).toEqual(["SQL is on the posting. Where have you used it?", "Kubernetes is on the posting. How would you get up to speed?"]);
  });

  it("keeps every question short and conversational", () => {
    for (const question of buildInterviewPlan(inputs()).questions) expect(words(question.text)).toBeLessThanOrEqual(MAX_WORDS);
  });

  it("says what it saw on the resume, in plain words", () => {
    const [first, second] = buildInterviewPlan(inputs()).questions;
    expect(first.text).toMatch(/^I saw you built a Python Flask API/);
    expect(first.text).toContain("ATB Financial");
    expect(second.text).toMatch(/^I saw you wrote SQL reports/);
  });

  it("asks about research the way a person would", () => {
    const researcher = { ...profile, experience: [{ role: "Research Assistant", org: "Starfish" }], skills: [] };
    const [first] = buildInterviewPlan(inputs({ profile: researcher })).questions;
    expect(first.text).toBe("I saw you did research for Starfish. Could you tell me about that?");
  });

  it("matches technical questions to the target role, not just the degree", () => {
    const technical = (role: string) =>
      buildInterviewPlan(inputs({ role, reportedQuestions: [], profile: emptyProfile() })).questions.filter((q) => q.source === "technical");
    expect(technical("Junior data analyst")[0].text).toMatch(/missing values/);
    expect(technical("Software developer")[0].text).toMatch(/web address/);
    expect(technical("Staff accountant")[0].text).toMatch(/financial statements/);
    expect(technical("Registered nurse")[0].text).toMatch(/patient/);
    expect(technical("Marketing coordinator")).toHaveLength(2);
  });

  it("skips reported questions too long to say naturally", () => {
    const long = { text: "Please describe in great detail every single step of the process you would follow to migrate a legacy data warehouse to the cloud.", last_reported_at: null };
    const plan = buildInterviewPlan(inputs({ reportedQuestions: [long] }));
    expect(plan.questions.some((q) => q.source === "reported")).toBe(false);
  });

  it("falls back to short behavioural questions with no company, resume or known field", () => {
    const plan = buildInterviewPlan(inputs({ role: "entry-level", company: null, reportedQuestions: [], facts: [], profile: emptyProfile() }));
    expect(plan.questions.length).toBe(MAX_QUESTIONS);
    expect(plan.questions.every((q) => q.source === "behavioral")).toBe(true);
  });

  it("keeps a quick interview to two questions: an opener from their profile, then one behavioural", () => {
    const plan = buildInterviewPlan(inputs({ length: "quick" }));
    expect(plan.length).toBe("quick");
    expect(plan.questions.map((q) => q.source)).toEqual(["resume", "behavioral"]);
    expect(plan.questions[0].text).toMatch(/^I saw you built a Python Flask API/);
  });

  it("opens a quick interview with the role when there's nothing on the profile yet", () => {
    const plan = buildInterviewPlan(inputs({ length: "quick", role: "Barista", profile: emptyProfile(), reportedQuestions: [] }));
    expect(plan.questions.map((q) => q.text)).toEqual(["So what draws you to the Barista role?", "Tell me about a time you had to learn something fast."]);
  });

  it("is a full interview unless asked otherwise", () => {
    expect(buildInterviewPlan(inputs()).length).toBe("full");
  });
});
