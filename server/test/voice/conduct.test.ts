import { describe, expect, it } from "vitest";
import { endedForConduct, noteConductEnding } from "../../src/voice/conduct";
import type { Debrief } from "../../src/voice/debrief";
import { CONDUCT_CLOSE } from "../../src/voice/instructions";

const turns = (...questions: string[]) => questions.map((question) => ({ question }));
const debrief: Debrief = { overall: 40, verdict: "Short answers.", strengths: [], improvements: [], perQuestion: [], nextSteps: ["Add a number."] };

describe("conduct ending", () => {
  it("spots the fixed closing sentence in the agent's last line, curly apostrophe or not", () => {
    expect(endedForConduct(turns("Tell me about a project."), `${CONDUCT_CLOSE} Thank you for your time. Goodbye.`)).toBe(true);
    expect(endedForConduct(turns("Q1"), "I’m going to end the interview here. Goodbye.")).toBe(true);
  });

  it("spots it when the candidate still spoke after it", () => {
    expect(endedForConduct(turns("Q1", `${CONDUCT_CLOSE} Goodbye.`))).toBe(true);
  });

  it("leaves an ordinary goodbye or a boundary alone", () => {
    expect(endedForConduct(turns("Q1"), "Thanks so much, you'll hear from us by email. Goodbye.")).toBe(false);
    expect(endedForConduct(turns("I'd like us to keep this respectful. Shall we carry on?"))).toBe(false);
    expect(endedForConduct([], undefined)).toBe(false);
  });

  it("says so up front in the report", () => {
    const noted = noteConductEnding(debrief);
    expect(noted.endedEarly).toBe("conduct");
    expect(noted.verdict).toMatch(/^The interviewer ended this interview early/);
    expect(noted.verdict).toContain("Short answers.");
    expect(noted.nextSteps[0]).toMatch(/professional/i);
    expect(noted.overall).toBe(40);
  });
});
