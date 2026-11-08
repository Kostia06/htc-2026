import { describe, expect, it, vi } from "vitest";
import { describeLaunch, emitLaunch, onLaunch } from "./launches";

describe("handing a launch to the scene", () => {
  it("calls every registered listener once and stops after unsubscribe", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onLaunch(first);
    const stopSecond = onLaunch(second);
    expect(emitLaunch({ mode: "interview" })).toBe(2);
    stopFirst();
    expect(emitLaunch({ mode: "interview" })).toBe(1);
    stopSecond();
    expect(emitLaunch({ mode: "interview" })).toBe(0);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("describes what is starting", () => {
    expect(describeLaunch({ mode: "interview", companySlug: "atb" })).toBe("Starting your interview with ATB…");
    expect(describeLaunch({ mode: "interview", companySlug: "neo-financial" })).toBe("Starting your interview with Neo Financial…");
    expect(describeLaunch({ mode: "interview", companySlug: "acme-corp" })).toBe("Starting your interview with Acme Corp…");
    expect(describeLaunch({ mode: "interview" })).toBe("Starting your interview…");
  });
});
