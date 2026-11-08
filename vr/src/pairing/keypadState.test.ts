import { describe, expect, it } from "vitest";
import { type KeypadEvent, type KeypadState, initialKeypadState, reduceKeypad } from "./keypadState";

const run = (events: KeypadEvent[], from: KeypadState = initialKeypadState) => events.reduce(reduceKeypad, from);
const type = (digits: string): KeypadEvent[] => [...digits].map((digit) => ({ type: "digit", digit }));
const session = { token: "t0k", expiresAt: "2026-11-08T00:00:00Z" };

describe("keypad", () => {
  it("collects digits until the fourth, then checks the code by itself", () => {
    expect(run(type("482"))).toMatchObject({ phase: "entering", digits: "482" });
    expect(run(type("4821"))).toMatchObject({ phase: "checking", digits: "4821" });
  });

  it("removes the last digit on backspace", () => {
    expect(run([...type("48"), { type: "backspace" }])).toMatchObject({ phase: "entering", digits: "4" });
    expect(run([{ type: "backspace" }])).toMatchObject({ phase: "entering", digits: "" });
  });

  it("ignores keys while a code is being checked", () => {
    const checking = run(type("4821"));
    expect(run([{ type: "digit", digit: "9" }, { type: "backspace" }], checking)).toBe(checking);
  });

  it("ignores anything that isn't a single digit", () => {
    expect(run([{ type: "digit", digit: "a" }, { type: "digit", digit: "12" }])).toBe(initialKeypadState);
  });

  it("clears the digits and shakes again on every wrong code", () => {
    const once = run([...type("4821"), { type: "failed", problem: "wrong" }]);
    expect(once).toMatchObject({ phase: "entering", digits: "", notice: "wrong", shakes: 1 });
    expect(run([...type("1111"), { type: "failed", problem: "wrong" }], once)).toMatchObject({ shakes: 2 });
  });

  it("keeps the notice until the person starts typing again", () => {
    const limited = run([...type("4821"), { type: "failed", problem: "rate_limited" }]);
    expect(limited).toMatchObject({ notice: "rate_limited" });
    expect(run(type("1"), limited)).toMatchObject({ digits: "1", notice: null });
  });

  it("says why after a network problem without shaking, since the code may be right", () => {
    const offline = run([...type("4821"), { type: "failed", problem: "offline" }]);
    expect(offline).toMatchObject({ phase: "entering", digits: "", notice: "offline", shakes: 0 });
  });

  it("signs in with the token from a right code", () => {
    expect(run([...type("4821"), { type: "claimed", session }])).toEqual({ phase: "signedIn", session });
  });

  it("drops an answer that arrives when nothing is being checked", () => {
    expect(run([{ type: "claimed", session }])).toBe(initialKeypadState);
  });
});
