import { describe, expect, it } from "vitest";
import { chooseToSay, daysUntil, isQuietHours, isValidTimezone } from "../../src/notifications/rules";
import type { Candidate, NotificationKind } from "../../src/notifications/types";

const candidate = (kind: NotificationKind, key: string): Candidate => ({ kind, key, title: key, body: "", target: { type: "feed", id: key } });

describe("chooseToSay", () => {
  it("drops what was already said and kinds the person turned off", () => {
    const out = chooseToSay([candidate("feed_match", "a"), candidate("deadline", "b"), candidate("company_news", "c")], {
      said: new Set(["a"]),
      sentToday: 0,
      disabled: ["company_news"],
    });
    expect(out.map((c) => c.key)).toEqual(["b"]);
  });

  it("keeps to three a day counting what already went out, most awaited first", () => {
    const all = [candidate("feed_match", "f"), candidate("road_nudge", "n"), candidate("report_ready", "r"), candidate("deadline", "d")];
    expect(chooseToSay(all, { said: new Set(), sentToday: 0, disabled: [] }).map((c) => c.key)).toEqual(["r", "d", "n"]);
    expect(chooseToSay(all, { said: new Set(), sentToday: 2, disabled: [] }).map((c) => c.key)).toEqual(["r"]);
    expect(chooseToSay(all, { said: new Set(), sentToday: 5, disabled: [] })).toEqual([]);
  });

  it("says the same key once even when two sources produce it", () => {
    const out = chooseToSay([candidate("deadline", "x"), candidate("deadline", "x")], { said: new Set(), sentToday: 0, disabled: [] });
    expect(out).toHaveLength(1);
  });
});

describe("quiet hours", () => {
  it("is 21:00 to 08:00 in the person's own timezone", () => {
    const at = new Date("2026-11-08T04:30:00Z"); // 21:30 in Calgary, 04:30 in London
    expect(isQuietHours(at, "America/Edmonton")).toBe(true);
    expect(isQuietHours(at, "Europe/London")).toBe(true);
    expect(isQuietHours(new Date("2026-11-08T18:00:00Z"), "America/Edmonton")).toBe(false); // 11:00
    expect(isQuietHours(new Date("2026-11-08T15:00:00Z"), "America/Edmonton")).toBe(false); // 08:00 exactly
  });

  it("treats a missing or bogus timezone as UTC", () => {
    expect(isQuietHours(new Date("2026-11-08T12:00:00Z"), null)).toBe(false);
    expect(isQuietHours(new Date("2026-11-08T23:00:00Z"), "Not/AZone")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(isValidTimezone("America/Edmonton")).toBe(true);
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  it("counts whole days to a date inside the window", () => {
    expect(daysUntil("2026-11-10T12:00:00Z", now, 3)).toBe(2);
    expect(daysUntil("2026-11-08T20:00:00Z", now, 3)).toBe(1);
  });
  it("ignores labels, past dates and dates beyond the window", () => {
    expect(daysUntil("ongoing", now, 3)).toBeNull();
    expect(daysUntil("2026-11-07", now, 3)).toBeNull();
    expect(daysUntil("2026-11-20", now, 3)).toBeNull();
  });
});
