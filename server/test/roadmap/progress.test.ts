import { describe, expect, it } from "vitest";
import { dayOf, groupByDay, isTimeZone, streakDays } from "../../src/roadmap/progress";
import type { Step } from "../../src/roadmap/types";

const done = (id: string, completedAt: string): Step => ({
  id,
  kind: "project",
  title: id,
  why: "",
  detail: "",
  estimate: "",
  label: "ready_now",
  status: "done",
  completedAt,
  note: null,
  source: "template",
});

describe("dayOf", () => {
  it("puts a late UTC evening on the same day where the person lives", () => {
    expect(dayOf("2026-11-08T03:30:00Z", "UTC")).toBe("2026-11-08");
    expect(dayOf("2026-11-08T03:30:00Z", "America/Edmonton")).toBe("2026-11-07");
  });

  it("falls back to UTC for a zone it doesn't know", () => {
    expect(dayOf("2026-11-08T03:30:00Z", "Mars/Olympus")).toBe("2026-11-08");
    expect(isTimeZone("America/Edmonton")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("groupByDay", () => {
  it("keeps newest first and folds steps finished on the same day together", () => {
    const groups = groupByDay(
      [done("c", "2026-11-07T20:00:00Z"), done("b", "2026-11-07T09:00:00Z"), done("a", "2026-11-05T09:00:00Z")],
      "UTC",
    );
    expect(groups.map((g) => [g.day, g.steps.map((s) => s.id)])).toEqual([
      ["2026-11-07", ["c", "b"]],
      ["2026-11-05", ["a"]],
    ]);
  });
});

describe("streakDays", () => {
  const now = new Date("2026-11-07T18:00:00Z");

  it("counts consecutive days back from today", () => {
    expect(streakDays(["2026-11-07T10:00:00Z", "2026-11-06T10:00:00Z", "2026-11-05T10:00:00Z", "2026-11-01T10:00:00Z"], "UTC", now)).toBe(3);
  });

  it("still counts a streak that ended yesterday, so the day isn't lost before it is over", () => {
    expect(streakDays(["2026-11-06T10:00:00Z", "2026-11-05T10:00:00Z"], "UTC", now)).toBe(2);
    expect(streakDays(["2026-11-05T10:00:00Z"], "UTC", now)).toBe(0);
    expect(streakDays([], "UTC", now)).toBe(0);
  });
});
