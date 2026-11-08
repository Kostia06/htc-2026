import { describe, expect, it } from "vitest";
import { alignTurns, overlap, quoteTime, type TimedLine } from "../../src/replay/align";

const agent = (t: number, text: string): TimedLine => ({ t, speaker: "agent", text });
const person = (t: number, text: string): TimedLine => ({ t, speaker: "person", text });

const lines = [
  agent(0, "Hi, thanks for coming in. Tell me about a project you're proud of."),
  person(6, "I rebuilt our reporting pipeline at ATB."),
  person(14, "It went from four hours to forty minutes."),
  agent(30, "Nice. Describe a time you learned something quickly."),
  person(36, "I had two weeks to learn dbt for a migration."),
  agent(70, "Thanks, that's all from me."),
];

describe("overlap", () => {
  it("is the share of the line's words found in the text, ignoring case and punctuation", () => {
    expect(overlap("Four hours, to FORTY minutes!", "it went from four hours to forty minutes")).toBe(1);
    expect(overlap("totally different words", "four hours")).toBe(0);
    expect(overlap("", "anything")).toBe(0);
  });
});

describe("alignTurns", () => {
  it("starts each answer at the first line the person said for it and ends it when the interviewer speaks", () => {
    const turns = [
      { answer: "I rebuilt our reporting pipeline at ATB. It went from four hours to forty minutes." },
      { answer: "I had two weeks to learn dbt for a migration." },
    ];
    expect(alignTurns(turns, lines, 75)).toEqual([
      { start: 6, end: 30 },
      { start: 36, end: 70 },
    ]);
  });

  it("keeps going in order, so a repeated phrase can't pull a later answer back in time", () => {
    const repeated = [person(5, "I think so."), agent(10, "Go on."), person(12, "I think so.")];
    expect(alignTurns([{ answer: "I think so." }, { answer: "I think so." }], repeated, 20)).toEqual([
      { start: 5, end: 10 },
      { start: 12, end: 20 },
    ]);
  });

  it("places an answer it can't find between its neighbours instead of dropping it", () => {
    const turns = [
      { answer: "I rebuilt our reporting pipeline at ATB." },
      { answer: "something the transcript never caught" },
      { answer: "I had two weeks to learn dbt for a migration." },
    ];
    const [first, missing, third] = alignTurns(turns, lines, 75);
    expect(first.start).toBe(6);
    expect(third.start).toBe(36);
    expect(missing.start).toBeGreaterThanOrEqual(first.end);
    expect(missing.end).toBeLessThanOrEqual(third.start);
  });

  it("spreads answers evenly over the call when nothing matches at all", () => {
    expect(alignTurns([{ answer: "x y z" }, { answer: "q r s" }], [], 100)).toEqual([
      { start: 0, end: 50 },
      { start: 50, end: 100 },
    ]);
  });
});

describe("quoteTime", () => {
  it("finds the line inside the answer that the quote came from", () => {
    expect(quoteTime("four hours to forty minutes", lines, { start: 6, end: 30 })).toBe(14);
  });

  it("falls back to the answer's start when the quote was paraphrased", () => {
    expect(quoteTime("cut the run time a lot", lines, { start: 6, end: 30 })).toBe(6);
  });
});
