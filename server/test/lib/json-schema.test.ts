import { describe, expect, it } from "vitest";
import { schemaError, type JsonSchema } from "../../src/lib/json-schema";

const schema: JsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string", maxLength: 10 },
    level: { type: "string", enum: ["low", "high"] },
    steps: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: { type: "object", properties: { step: { type: "string" }, score: { type: "number" } }, required: ["step"] },
    },
  },
  required: ["summary", "steps"],
};

describe("schemaError", () => {
  it("accepts a value that matches", () => {
    expect(schemaError(schema, { summary: "ok", steps: [{ step: "a", score: 2 }] })).toBeNull();
  });

  it("names a missing required field", () => {
    expect(schemaError(schema, { steps: [{ step: "a" }] })).toBe("summary is required");
  });

  it("names a wrong type deep inside an array", () => {
    expect(schemaError(schema, { summary: "ok", steps: [{ step: 3 }] })).toBe("steps[0].step must be a string");
  });

  it("checks enums, lengths and item counts", () => {
    expect(schemaError(schema, { summary: "ok", level: "mid", steps: [{ step: "a" }] })).toBe("level must be one of low, high");
    expect(schemaError(schema, { summary: "far too long", steps: [{ step: "a" }] })).toBe("summary must be at most 10 characters");
    expect(schemaError(schema, { summary: "ok", steps: [] })).toBe("steps must have at least 1 items");
    expect(schemaError(schema, { summary: "ok", steps: [{ step: "a" }, { step: "b" }, { step: "c" }] })).toBe("steps must have at most 2 items");
  });

  it("rejects a value that is not an object at all", () => {
    expect(schemaError(schema, "nope")).toBe("input must be an object");
  });
});
