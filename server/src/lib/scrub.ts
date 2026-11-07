import { anonymize } from "./anonymize";

// agent output can quote web pages or the user's own words, so contact details are stripped on the way out
export function scrubStrings<T>(value: T): T {
  if (typeof value === "string") return anonymize(value) as T;
  if (Array.isArray(value)) return value.map(scrubStrings) as T;
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, scrubStrings(v)])) as T;
  }
  return value;
}
