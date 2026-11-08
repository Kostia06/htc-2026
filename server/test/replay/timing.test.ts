import { describe, expect, it } from "vitest";
import { replayFrom } from "../../src/replay/build";
import type { Conversation } from "../../src/replay/elevenlabs";
import { measureDelivery } from "../../src/voice/delivery";
import type { StoredTurn } from "../../src/voice/store";

// a middling answer: neither a mistake nor a strength, so only the dots under test appear
const scores = { structure: 4, relevance: 3, specificity: 3, confidence: 4 };
const turn = (idx: number, answer: string, over: Partial<StoredTurn> = {}): StoredTurn => ({
  idx,
  question: `Question ${idx + 1}`,
  answer,
  scores,
  delivery: measureDelivery(answer, 0),
  tip: "a tip",
  ...over,
});

const TEAM = "We shipped it and we were happy with how our launch went and we moved on.";
// ElevenLabs' transcript disagrees with our clock on purpose: live timestamps must win over word matching
const conversation: Conversation = {
  status: "ready",
  durationSec: 120,
  lines: [
    { t: 0, speaker: "agent", text: "Question one." },
    { t: 3, speaker: "person", text: "I rebuilt the reporting pipeline." },
    { t: 50, speaker: "person", text: TEAM },
  ],
};

describe("replay from live timestamps", () => {
  it("puts each answer's dots a second and a half before the person started, not where the words matched", () => {
    const turns = [
      turn(0, "I rebuilt the reporting pipeline.", { answerStartSec: 10, atSec: 20, scores: { structure: 1, relevance: 1, specificity: 1, confidence: 1 } }),
      turn(1, TEAM, { answerStartSec: 61, atSec: 70 }),
    ];
    const replay = replayFrom("s1", turns, null, conversation);
    expect(replay.timing).toBe("seconds");
    expect(replay.moments.find((m) => m.kind === "mistake")?.t).toBe(8.5);
    expect(replay.moments.find((m) => m.kind === "delivery")).toMatchObject({ t: 59.5, title: "\"We\" 4 times, \"I\" 0" });
  });

  it("never seeks before the start of the call", () => {
    const replay = replayFrom("s1", [turn(0, "Hi.", { answerStartSec: 0.5, scores: { structure: 1 } })], null, conversation);
    expect(replay.moments[0].t).toBe(0);
  });

  it("falls back to matching the transcript for sessions recorded before timestamps", () => {
    const replay = replayFrom("s1", [turn(0, "I rebuilt the reporting pipeline.", { scores: { structure: 1 } })], null, conversation);
    expect(replay.moments[0].t).toBe(3);
  });

  it("shows researched tips with their sources, and plain ones as coaching", () => {
    const sources = [{ title: "Our values", url: "https://acme.example/values" }];
    const turns = [
      turn(0, "I did a thing.", { answerStartSec: 10, liveTip: { kind: "researched", said: "I did a thing.", rewrite: "I cut it by [number].", why: "Acme hires for ownership.", sources } }),
      turn(1, "Another thing.", { answerStartSec: 40, liveTip: { kind: "coaching", said: "Another thing.", rewrite: "Say the result.", why: "Results land.", sources: [] } }),
    ];
    const replay = replayFrom("s1", turns, null, { ...conversation, lines: [] });
    expect(replay.moments.find((m) => m.kind === "researched")).toMatchObject({ t: 8.5, sources, better: "I cut it by [number]." });
    expect(replay.moments.find((m) => m.title === "Coaching tip")).toMatchObject({ kind: "better", t: 38.5 });
    expect(replay.transcript.length).toBe(4);
  });
});
