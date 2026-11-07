import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSkill } from "../../../../src/agents/core/harness";
import type { CompanyInsights } from "../../../../src/agents/core/types";
import { interviewPrep } from "../../../../src/agents/interview/skills/interview-prep";
import { ACME, call, fakeDeps, fakeMemory, fakeServices } from "../../fakes";

const insights: CompanyInsights = {
  company: { ...ACME, last_researched_at: null },
  facts: [],
  reportCount: 3,
  questions: [
    { text: "Tell me about a bug you fixed", count: 3, example: false, last_reported_at: "2026-11" },
    { text: "Why Acme?", count: 1, example: true, last_reported_at: null },
  ],
};

const question = (text: string, reported: boolean) => ({ text, why: "It came up before.", reported });
const five = [
  question("Tell me about a bug you fixed", false),
  question("Why Acme?", true),
  question("Invented question", true),
  question("How do you test your code?", false),
  question("Describe a conflict in a team", false),
];

const request = (input: unknown) => ({ skill: interviewPrep, platform: "vr" as const, userId: "u1", input });

describe("interview-prep skill", () => {
  beforeEach(async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name, website) VALUES ('c1', 'acme', 'Acme', 'https://acme.com')").run();
  });

  it("runs on the app and in VR", () => {
    expect(interviewPrep.platforms).toEqual(["app", "vr"]);
  });

  it("needs a company", async () => {
    const { deps } = fakeDeps();
    await expect(runSkill(deps, request({ role: "Junior Developer" }))).rejects.toMatchObject({ status: 400 });
  });

  it("picks five questions, marking as reported only those real candidates reported", async () => {
    const memory = fakeMemory([{ kind: "weakness", text: "Vague about testing" }]);
    const { deps, prompts } = fakeDeps({
      memory,
      services: fakeServices({ companyInsights: vi.fn(async () => insights) }),
      replies: [call("company_insights", { role: "Junior Developer" }), call("recall", { kinds: ["weakness"] }), call("finish", { questions: five, focus: ["testing"] })],
    });
    const result = await runSkill(deps, request({ company: "acme", role: "Junior Developer" }));
    if (result.status !== "done") throw new Error(result.error);
    const questions = result.output.questions as { reported: boolean }[];
    expect(questions.map((q) => q.reported)).toEqual([true, false, false, false, false]);
    expect(result.output.focus).toEqual(["testing"]);
    expect(prompts[0]).toContain("[weakness] Vague about testing");
  });

  it("puts reported questions first, in the order company_insights ranked them (most recent first)", async () => {
    const ranked: CompanyInsights = {
      ...insights,
      questions: [
        { text: "Walk me through your last project", count: 1, example: false, last_reported_at: "2026-11" },
        { text: "Tell me about a bug you fixed", count: 3, example: false, last_reported_at: "2026-05" },
      ],
    };
    const handedIn = [
      question("How do you test your code?", false),
      question("Tell me about a bug you fixed", true),
      question("Describe a conflict in a team", false),
      question("walk me through your last project", true),
      question("Why Acme?", false),
    ];
    const { deps } = fakeDeps({
      services: fakeServices({ companyInsights: vi.fn(async () => ranked) }),
      replies: [call("company_insights", {}), call("finish", { questions: handedIn, focus: [] })],
    });
    const result = await runSkill(deps, request({ company: "acme" }));
    if (result.status !== "done") throw new Error(result.error);
    const texts = (result.output.questions as { text: string }[]).map((q) => q.text);
    expect(texts).toEqual([
      "walk me through your last project",
      "Tell me about a bug you fixed",
      "How do you test your code?",
      "Describe a conflict in a team",
      "Why Acme?",
    ]);
  });

  it("makes the model try again when it hands in fewer than five questions", async () => {
    const { deps, conversations } = fakeDeps({
      replies: [call("finish", { questions: five.slice(0, 4), focus: [] }), call("finish", { questions: five, focus: [] })],
    });
    const result = await runSkill(deps, request({ company: "acme" }));
    expect(conversations[1].at(-1)?.parts[0].functionResponse?.response).toMatchObject({ error: expect.stringContaining("at least 5") });
    expect(result.status).toBe("done");
  });
});
