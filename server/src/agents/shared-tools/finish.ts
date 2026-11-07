import { schemaError, type JsonSchema } from "../../lib/json-schema";
import type { ToolDefinition } from "../core/types";

// built per skill: its parameters are the skill's output schema
export function finishTool(outputSchema: JsonSchema): ToolDefinition {
  return {
    name: "finish",
    description: "Hand in your final result. Call it exactly once, when you are done.",
    parameters: outputSchema,
    terminal: true,
    run: async (args) => {
      const error = schemaError(outputSchema, args);
      return error ? { error: `${error}. Fix it and call finish again.` } : { accepted: true };
    },
  };
}
