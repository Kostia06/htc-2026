import { describe, expect, it } from "vitest";
import { fallbackDebrief } from "../../src/voice/debrief";
import { curiosityOf, INTEREST_STEP, INTEREST_WHY, withInterest } from "../../src/voice/interest";

const turn = (question: string, answer: string) => ({ question, answer });
const interview = [turn("Tell me about a project you're proud of.", "I built a dashboard that cut reporting time in half.")];
const closing = "Thanks. Do you have any questions for me?";

describe("curiosity at the end of the interview", () => {
  it("notes a real question asked when invited", () => {
    const turns = [...interview, turn(closing, "Yes. What does a typical week look like for the analytics team?")];
    expect(curiosityOf(turns)).toEqual({ asked: true, quote: "What does a typical week look like for the analytics team?" });
  });

  it("counts a question asked after an 'anything else?'", () => {
    const turns = [...interview, turn(closing, "Hmm, let me think."), turn("Anything else?", "How do you measure success in the first three months?")];
    expect(curiosityOf(turns)?.asked).toBe(true);
  });

  it("notes when they had nothing to ask", () => {
    expect(curiosityOf([...interview, turn(closing, "No, I'm good, thanks.")])).toEqual({ asked: false, quote: null });
  });

  it("says nothing when the closing question never came", () => {
    expect(curiosityOf(interview)).toBeNull();
  });

  it("adds a 'Showed interest' strength, or a tip to prepare questions", () => {
    const base = fallbackDebrief([]);
    const asked = withInterest(base, [...interview, turn(closing, "What are the team's goals for next year?")]);
    expect(asked.strengths.at(-1)).toEqual({ quote: "What are the team's goals for next year?", why: INTEREST_WHY });
    expect(asked.interest?.asked).toBe(true);

    const quiet = withInterest(base, [...interview, turn(closing, "Nope.")]);
    expect(quiet.nextSteps.at(-1)).toBe(INTEREST_STEP);
    expect(withInterest(base, interview)).toBe(base);
  });
});
