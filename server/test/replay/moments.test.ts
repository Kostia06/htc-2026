import { describe, expect, it } from "vitest";
import type { TimedLine } from "../../src/replay/align";
import { buildMoments, separate } from "../../src/replay/moments";
import type { Debrief } from "../../src/voice/debrief";
import type { StoredTurn } from "../../src/voice/store";

const delivery = { words: 20, fillerWords: 0, wordsPerMinute: 130 };
const turn = (idx: number, over: Partial<StoredTurn>): StoredTurn => ({
  idx,
  question: `Question ${idx + 1}`,
  answer: "an answer",
  scores: { structure: 3, relevance: 3, specificity: 3, confidence: 3 },
  delivery,
  tip: "a tip",
  ...over,
});

const turns = [
  turn(0, {
    question: "Tell me about a project you're proud of.",
    answer: "I rebuilt our reporting pipeline. It went from four hours to forty minutes.",
    scores: { structure: 5, relevance: 5, specificity: 4, confidence: 5 },
  }),
  turn(1, {
    question: "Why our lending team?",
    answer: "I think fintech is really interesting and I'd learn a lot.",
    scores: { structure: 2, relevance: 2, specificity: 1, confidence: 3 },
    tip: "Add one concrete detail.",
    delivery: { ...delivery, fillerWords: 4 },
  }),
];
const lines: TimedLine[] = [
  { t: 5, speaker: "person", text: "I rebuilt our reporting pipeline." },
  { t: 12, speaker: "person", text: "It went from four hours to forty minutes." },
  { t: 40, speaker: "person", text: "I think fintech is really interesting and I'd learn a lot." },
];
const spans = [
  { start: 5, end: 30 },
  { start: 40, end: 60 },
];

const report: Debrief = {
  overall: 60,
  verdict: "ok",
  strengths: [{ quote: "four hours to forty minutes", why: "A number makes it land." }],
  improvements: [
    { moment: "Why our lending team?", said: "fintech is really interesting", better: "Name something they do.", example: "You shipped instant approvals; I want in." },
    { moment: "Something never asked", said: "words nobody said", better: "x", example: "y" },
  ],
  perQuestion: [
    { question: "Tell me about a project you're proud of.", score: 85, oneLineFeedback: "Strong." },
    { question: "Why our lending team?", score: 40, oneLineFeedback: "Generic, name one thing they do." },
  ],
  nextSteps: [],
};

describe("buildMoments", () => {
  it("turns the report into dots at the moment each thing was said, in time order", () => {
    const moments = buildMoments(turns, report, spans, lines);
    expect(moments.map((m) => [m.t, m.kind])).toEqual([
      [12, "strength"],
      [40, "mistake"],
      [40, "better"],
      [40, "filler"],
    ]);
    const [strength, mistake, better, filler] = moments;
    expect(strength).toMatchObject({ detail: "A number makes it land.", said: "four hours to forty minutes", turn: 0, question: "Tell me about a project you're proud of." });
    // the weakest score names the problem; the report's line explains it
    expect(mistake).toMatchObject({ title: "Stayed too general", detail: "Generic, name one thing they do.", turn: 1 });
    expect(better).toMatchObject({ detail: "Name something they do.", better: "You shipped instant approvals; I want in.", said: "fintech is really interesting" });
    expect(filler).toMatchObject({ title: "4 filler words", turn: 1 });
  });

  it("leaves out report items it can't tie to any answer", () => {
    const moments = buildMoments(turns, report, spans, lines);
    expect(moments.some((m) => m.said === "words nobody said")).toBe(false);
  });

  it("without a saved report, falls back to each answer's own scores and tip", () => {
    const moments = buildMoments(turns, null, spans, lines);
    expect(moments.map((m) => [m.kind, m.turn])).toEqual([
      ["strength", 0],
      ["mistake", 1],
      ["filler", 1],
    ]);
    expect(moments[0]).toMatchObject({ title: "Strong answer", t: 5 });
    expect(moments[1]).toMatchObject({ detail: "Add one concrete detail." });
  });

  it("says nothing about an unscored middling answer", () => {
    expect(buildMoments([turn(0, { scores: {} })], null, [{ start: 0, end: 1 }], [])).toEqual([]);
  });
});

describe("separate", () => {
  it("nudges dots that land on the same second apart so each can be tapped", () => {
    const moments = buildMoments(turns, report, spans, lines);
    expect(separate(moments).map((m) => m.t)).toEqual([12, 40, 41, 42]);
  });
});
