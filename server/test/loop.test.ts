import { describe, expect, it, vi } from "vitest";
import type { GeminiContent } from "../src/ai/gemini";
import { runAgent, type Tool } from "../src/agent/loop";

function scripted(replies: GeminiContent[]) {
  const seen: GeminiContent[][] = [];
  const model = vi.fn(async (contents: GeminiContent[]) => {
    seen.push(structuredClone(contents));
    return replies.shift()!;
  });
  return { model, seen };
}

const echo: Tool = {
  declaration: { name: "echo", description: "echo", parameters: { type: "object", properties: { v: { type: "string" } } } },
  run: vi.fn(async (args) => ({ got: args.v })),
};

describe("runAgent", () => {
  it("runs requested tools and feeds results back until the model answers", async () => {
    const replies: GeminiContent[] = [
      { role: "model", parts: [{ functionCall: { name: "echo", args: { v: "hi" } } }] },
      { role: "model", parts: [{ text: "done" }] },
    ];
    const { model, seen } = scripted(replies);
    const result = await runAgent({ model, tools: { echo }, goal: "say hi", maxSteps: 5 });
    expect(result.answer).toBe("done");
    expect(echo.run).toHaveBeenCalledWith({ v: "hi" });
    expect(seen[1].at(-1)?.parts[0].functionResponse).toEqual({ name: "echo", response: { got: "hi" } });
  });

  it("stops after maxSteps even if the model keeps calling tools", async () => {
    const model = vi.fn(async (): Promise<GeminiContent> => ({ role: "model", parts: [{ functionCall: { name: "echo", args: {} } }] }));
    const result = await runAgent({ model, tools: { echo }, goal: "loop", maxSteps: 3 });
    expect(model).toHaveBeenCalledTimes(3);
    expect(result.stoppedEarly).toBe(true);
  });

  it("tells the model when it asks for a tool that doesn't exist", async () => {
    const replies: GeminiContent[] = [
      { role: "model", parts: [{ functionCall: { name: "nope", args: {} } }] },
      { role: "model", parts: [{ text: "ok" }] },
    ];
    const { model, seen } = scripted(replies);
    await runAgent({ model, tools: { echo }, goal: "x", maxSteps: 5 });
    expect(seen[1].at(-1)?.parts[0].functionResponse?.response).toEqual({ error: "unknown tool nope" });
  });

  it("runs at most 4 tool calls per model reply", async () => {
    const many = Array.from({ length: 6 }, () => ({ functionCall: { name: "echo", args: { v: "x" } } }));
    const replies: GeminiContent[] = [{ role: "model", parts: many }, { role: "model", parts: [{ text: "ok" }] }];
    const run = vi.fn(async () => ({}));
    const { model, seen } = scripted(replies);
    await runAgent({ model, tools: { echo: { ...echo, run } }, goal: "x", maxSteps: 5 });
    expect(run).toHaveBeenCalledTimes(4);
    const responses = seen[1].at(-1)!.parts;
    expect(responses).toHaveLength(6);
    expect(responses[5].functionResponse?.response).toEqual({ error: "too many tool calls in one step, max 4" });
  });
});
