import { describe, expect, it } from "vitest";
import { readProfileFromToolCalls } from "../../src/recommend/profile";
import { fetched, profileCall } from "./tool-calls";

describe("readProfileFromToolCalls", () => {
  it("collects every string the profile and recall tools returned, and their goals", () => {
    const snapshot = readProfileFromToolCalls([
      profileCall({ resume: { lines: ["4-month co-op using Python"] }, goals: ["data engineering"] }),
      { name: "recall", args: {}, result: { memories: [{ kind: "goal", text: "work at Shopify" }, { kind: "skill", text: "SQL" }] } },
      fetched("https://jobs.example.com/a", "Required: Kubernetes"),
    ]);
    expect(snapshot.text).toContain("4-month co-op using Python");
    expect(snapshot.text).toContain("SQL");
    expect(snapshot.text).not.toContain("Kubernetes");
    expect(snapshot.goals).toEqual(["data engineering", "work at Shopify"]);
  });

  it("ignores a profile call that failed", () => {
    expect(readProfileFromToolCalls([profileCall({ error: "no profile yet" })]).text).toBe("");
  });
});
