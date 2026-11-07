import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollEvery } from "./pollEvery";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("pollEvery", () => {
  it("polls right away and then every interval", async () => {
    const poll = vi.fn(async () => {});
    const stop = pollEvery(2000, poll);
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(poll).toHaveBeenCalledTimes(3);
    stop();
  });

  it("waits for a slow poll to finish before the next one", async () => {
    let finish = () => {};
    const poll = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const stop = pollEvery(2000, poll);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(poll).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(2000);
    expect(poll).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stops polling and aborts the request in flight", async () => {
    const signals: AbortSignal[] = [];
    const poll = vi.fn(async (signal: AbortSignal) => void signals.push(signal));
    const stop = pollEvery(2000, poll);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(true);
  });
});
