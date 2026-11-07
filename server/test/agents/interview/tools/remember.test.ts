import { describe, expect, it } from "vitest";
import { remember } from "../../../../src/agents/interview/tools/remember";
import { fakeMemory, toolContext } from "../../fakes";

describe("remember", () => {
  it("writes one item to the run's own memory port", async () => {
    const memory = fakeMemory();
    const out = await remember.run({ kind: "weakness", text: "  Gives vague answers about testing " }, toolContext({ memory }));
    expect(out).toMatchObject({ saved: true });
    expect(memory.items.map((m) => [m.kind, m.text])).toEqual([["weakness", "Gives vague answers about testing"]]);
  });

  it("rejects an unknown kind or empty text without writing", async () => {
    const memory = fakeMemory();
    expect(await remember.run({ kind: "secret", text: "x" }, toolContext({ memory }))).toMatchObject({ saved: false });
    expect(await remember.run({ kind: "note", text: "  " }, toolContext({ memory }))).toMatchObject({ saved: false });
    expect(memory.remember).not.toHaveBeenCalled();
  });

  it("keeps a memory short", async () => {
    const memory = fakeMemory();
    await remember.run({ kind: "note", text: "a".repeat(1000) }, toolContext({ memory }));
    expect(memory.items[0].text).toHaveLength(300);
  });
});
