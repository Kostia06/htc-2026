import { describe, expect, it } from "vitest";
import { measureDelivery } from "../../src/voice/delivery";

describe("measureDelivery", () => {
  it("counts filler words and speaking pace", () => {
    const answer = "Um, so I built, like, an API. Uh, it served, you know, two thousand users.";
    const delivery = measureDelivery(answer, 6000);
    expect(delivery.fillerWords).toBe(4);
    expect(delivery.wordsPerMinute).toBe(150);
  });

  it("copes with silence and missing durations", () => {
    expect(measureDelivery("", 0)).toEqual({ words: 0, fillerWords: 0, wordsPerMinute: null });
  });
});
