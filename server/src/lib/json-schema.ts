// the small JSON schema subset Gemini function declarations understand, plus a checker for it
export type JsonSchema = {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
};

const TYPE_NAMES = { object: "an object", array: "an array", string: "a string", number: "a number", integer: "an integer", boolean: "a boolean" };

function hasType(schema: JsonSchema, value: unknown) {
  switch (schema.type) {
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "integer":
      return Number.isInteger(value);
    default:
      return typeof value === schema.type;
  }
}

// returns the first problem as a sentence the model can act on, or null when the value fits
export function schemaError(schema: JsonSchema, value: unknown, path = ""): string | null {
  const label = path || "input";
  if (!hasType(schema, value)) return `${label} must be ${TYPE_NAMES[schema.type]}`;

  if (typeof value === "string") {
    if (schema.enum && !schema.enum.includes(value)) return `${label} must be one of ${schema.enum.join(", ")}`;
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) return `${label} must be at least ${schema.minLength} characters`;
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return `${label} must be at most ${schema.maxLength} characters`;
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) return `${label} must have at least ${schema.minItems} items`;
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${label} must have at most ${schema.maxItems} items`;
    for (const [i, item] of value.entries()) {
      const error = schema.items && schemaError(schema.items, item, `${label}[${i}]`);
      if (error) return error;
    }
  }

  if (schema.type === "object") {
    const record = value as Record<string, unknown>;
    const prefix = path ? `${path}.` : "";
    for (const key of schema.required ?? []) {
      if (record[key] === undefined || record[key] === null) return `${prefix}${key} is required`;
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (record[key] === undefined) continue;
      const error = schemaError(child, record[key], `${prefix}${key}`);
      if (error) return error;
    }
  }
  return null;
}
