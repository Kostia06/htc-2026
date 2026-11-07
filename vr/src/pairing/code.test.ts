import { describe, expect, it } from "vitest";
import { deadlineFor, formatCode, formatCountdown, secondsUntil } from "./code";

describe("formatCode", () => {
  it("splits the code into two groups of four for typing", () => {
    expect(formatCode("K7M2Q9XD")).toBe("K7M2 Q9XD");
  });

  it("cleans up case and stray characters first", () => {
    expect(formatCode("k7m2-q9xd")).toBe("K7M2 Q9XD");
    expect(formatCode("")).toBe("");
  });
});

describe("countdown", () => {
  it("rounds partial seconds up so it never shows 0:00 early", () => {
    expect(secondsUntil(10_500, 0)).toBe(11);
    expect(secondsUntil(0, 5_000)).toBe(0);
  });

  it("shows minutes and padded seconds", () => {
    expect(formatCountdown(300)).toBe("5:00");
    expect(formatCountdown(67)).toBe("1:07");
    expect(formatCountdown(0)).toBe("0:00");
  });
});

describe("deadlineFor", () => {
  const receivedAt = Date.parse("2026-11-07T12:00:00Z");

  it("uses the server's expiry when the clocks agree", () => {
    expect(deadlineFor("2026-11-07T12:04:30Z", receivedAt)).toBe(receivedAt + 270_000);
  });

  it("falls back to five minutes when the headset clock is far off", () => {
    expect(deadlineFor("2026-11-07T11:00:00Z", receivedAt)).toBe(receivedAt + 300_000);
    expect(deadlineFor("2026-11-07T14:00:00Z", receivedAt)).toBe(receivedAt + 300_000);
    expect(deadlineFor("not a date", receivedAt)).toBe(receivedAt + 300_000);
  });
});
