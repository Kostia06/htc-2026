import { describe, expect, it } from "vitest";
import { questionBank } from "../../../../src/agents/interview/tools/question-bank";
import { fieldQuestions } from "../../../../src/knowledge/interview";
import { toolContext } from "../../fakes";

describe("question_bank tool", () => {
  it("returns a field's curated examples, flagged as examples with round and what a good answer shows", async () => {
    const out = (await questionBank.run({ field: "health" }, toolContext())) as { example: boolean; questions: { round: string; text: string; shows: string }[] };
    expect(out.example).toBe(true);
    expect(out.questions.length).toBeGreaterThan(5);
    expect(out.questions[0]).toEqual(fieldQuestions.health[0]);
  });

  it("narrows to one round", async () => {
    const out = (await questionBank.run({ field: "trades", round: "practical" }, toolContext())) as { questions: { round: string }[] };
    expect(out.questions.length).toBeGreaterThan(0);
    expect(out.questions.every((q) => q.round === "practical")).toBe(true);
  });

  it("asks for a known field instead of guessing", async () => {
    expect(await questionBank.run({ field: "astrology" }, toolContext())).toMatchObject({ error: expect.stringContaining("software") });
  });
});
