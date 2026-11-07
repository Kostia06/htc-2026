import { describe, expect, it } from "vitest";
import { emptyProfile } from "../../src/memory/profile/patch";
import { buildInterviewPlan, buildNetworkingPlan, MAX_QUESTIONS } from "../../src/voice/plan";
import { inputs } from "./fixtures";

describe("interview plan", () => {
  it("asks what people reported recently first, then about the resume, then the role", () => {
    const plan = buildInterviewPlan(inputs());
    expect(plan.questions.map((q) => q.source)).toEqual(["reported", "reported", "resume", "resume", "behavioral", "behavioral"]);
    expect(plan.questions[0].text).toBe("Walk me through a SQL query you're proud of.");
  });

  it("quotes the resume word for word in resume questions", () => {
    const resumeQuestions = buildInterviewPlan(inputs()).questions.filter((q) => q.source === "resume");
    expect(resumeQuestions[0].text).toContain("Built a Python Flask API that served 2,000 internal users");
    expect(resumeQuestions[1].text).toContain("Wrote SQL reports in Postgres for the lending team");
  });

  it("never asks more than the limit and still works with no company or resume", () => {
    const plan = buildInterviewPlan(inputs({ company: null, reportedQuestions: [], facts: [], profile: emptyProfile() }));
    expect(plan.questions.length).toBe(MAX_QUESTIONS);
    expect(plan.questions.every((q) => q.source === "behavioral")).toBe(true);
    expect(plan.questions[0].text).toContain("Junior data analyst");
  });
});

describe("networking plan", () => {
  it("meets someone from the company and talks about what the company is doing", () => {
    const plan = buildNetworkingPlan(inputs());
    expect(plan.persona.company).toBe("Acme");
    expect(plan.talkingPoints).toContain("Acme opened a Calgary office in 2026.");
    expect(plan.goals).toHaveLength(3);
  });

  it("falls back to a Calgary meetup when no company is chosen", () => {
    const plan = buildNetworkingPlan(inputs({ company: null, facts: [] }));
    expect(plan.persona.company).toBeNull();
    expect(plan.talkingPoints.length).toBeGreaterThanOrEqual(3);
  });
});
