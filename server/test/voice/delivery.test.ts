import { describe, expect, it } from "vitest";
import { measureDelivery } from "../../src/voice/delivery";
import { deliveryIssues } from "../../src/voice/habits";

const LONG_VAGUE = "We worked on the platform and we tried to make it better for our users, and we kept iterating with the team. "
  + "It was kind of a big effort and maybe the hardest part was getting everyone aligned on what we wanted to build together over time.";

describe("measureDelivery", () => {
  it("counts filler words and speaking pace", () => {
    const answer = "Um, so I built, like, an API. Uh, it served, you know, two thousand users.";
    const delivery = measureDelivery(answer, 6000);
    expect(delivery.fillerWords).toBe(4);
    expect(delivery.wordsPerMinute).toBe(150);
  });

  it("copes with silence and missing durations", () => {
    expect(measureDelivery("", 0)).toEqual({ words: 0, fillerWords: 0, wordsPerMinute: null, hedges: 0, weCount: 0, iCount: 0, hasResult: false });
  });
});

describe("deliveryIssues", () => {
  it("flags hedging, a team story told with we, and a long answer with no result", () => {
    expect(deliveryIssues(measureDelivery(LONG_VAGUE, 0))).toEqual(["hedging", "we", "no_result"]);
  });

  it("leaves a crisp answer in the first person alone", () => {
    const crisp = "I rewrote the nightly job in SQL and cut it from four hours to forty minutes, so I owned the rollout myself.";
    expect(deliveryIssues(measureDelivery(crisp, 0))).toEqual([]);
  });

  it("only flags filler on turns stored before habits were measured", () => {
    expect(deliveryIssues({ words: 80, fillerWords: 4 })).toEqual(["filler"]);
  });
});
