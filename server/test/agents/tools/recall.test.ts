import { describe, expect, it } from "vitest";
import { recall } from "../../../src/agents/tools/recall";
import { fakeMemory, toolContext } from "../fakes";

describe("recall", () => {
  it("reads only the run's own memory port, filtered by kind", async () => {
    const memory = fakeMemory([
      { kind: "weakness", text: "Rambles on behavioural answers" },
      { kind: "goal", text: "Backend developer in Calgary" },
    ]);
    const out = await recall.run({ kinds: ["weakness"] }, toolContext({ memory }));
    expect(out).toEqual({ memories: [{ kind: "weakness", text: "Rambles on behavioural answers" }] });
    expect(memory.recall).toHaveBeenCalledWith({ query: undefined, kinds: ["weakness"], limit: 10 });
  });

  it("ignores unknown kinds and caps the limit", async () => {
    const memory = fakeMemory();
    await recall.run({ query: "sql", kinds: ["weakness", "password"], limit: 500 }, toolContext({ memory }));
    expect(memory.recall).toHaveBeenCalledWith({ query: "sql", kinds: ["weakness"], limit: 10 });
  });
});
