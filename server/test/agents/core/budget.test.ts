import { describe, expect, it, vi } from "vitest";
import { RUN_LIMITS, withBudget } from "../../../src/agents/core/budget";
import type { Tool } from "../../../src/agents/core/loop";

const tool = (name: string, terminal = false): Tool => ({
  declaration: { name, description: name, parameters: { type: "object" } },
  terminal,
  run: vi.fn(async () => ({ ok: true })),
});

describe("withBudget", () => {
  it("allows at most 6 page fetches per run", async () => {
    const tools = withBudget({ fetch_page: tool("fetch_page") });
    for (let i = 0; i < 6; i++) expect(await tools.fetch_page.run({})).toEqual({ ok: true });
    expect(await tools.fetch_page.run({})).toMatchObject({ error: expect.stringMatching(/fetch_page/) });
    expect(RUN_LIMITS.perTool.fetch_page).toBe(6);
  });

  it("allows at most 25 tool calls in total, but never blocks the terminal tool", async () => {
    const tools = withBudget({ recall: tool("recall"), finish: tool("finish", true) });
    for (let i = 0; i < 25; i++) await tools.recall.run({});
    expect(await tools.recall.run({})).toMatchObject({ error: expect.stringMatching(/call finish/) });
    expect(await tools.finish.run({})).toEqual({ ok: true });
  });
});
