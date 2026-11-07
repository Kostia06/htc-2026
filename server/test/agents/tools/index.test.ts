import { describe, expect, it } from "vitest";
import { tools } from "../../../src/agents/tools";

describe("tool registry", () => {
  it("keys every tool by its own name", () => {
    for (const [key, tool] of Object.entries(tools)) expect(tool.name).toBe(key);
  });

  it("has the shared tools, and finish is not one of them", () => {
    expect(Object.keys(tools).sort()).toEqual(
      ["company_facts", "company_insights", "fetch_page", "queue_research", "recall", "remember", "save_fact", "web_search"],
    );
  });
});
