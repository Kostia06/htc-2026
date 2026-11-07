import { describe, expect, it } from "vitest";
import { finishTool } from "../../../src/agents/shared-tools/finish";
import { toolContext } from "../fakes";

const finish = finishTool({ type: "object", properties: { summary: { type: "string" } }, required: ["summary"] });

describe("finish", () => {
  it("is terminal and takes the skill's output schema as its parameters", () => {
    expect(finish.name).toBe("finish");
    expect(finish.terminal).toBe(true);
    expect(finish.parameters.required).toEqual(["summary"]);
  });

  it("accepts output that fits the schema", async () => {
    expect(await finish.run({ summary: "ok" }, toolContext())).toEqual({ accepted: true });
  });

  it("tells the model what is wrong with output that doesn't fit", async () => {
    expect(await finish.run({}, toolContext())).toEqual({ error: "summary is required. Fix it and call finish again." });
  });
});
