import { describe, expect, it } from "vitest";
import { capWords, NOTHING_CHANGED, quickUpdate, type QuickUpdateInput } from "../../../../src/agents/career/skills/quick-update";
import { toolContext } from "../../fakes";

const input = (over: Partial<QuickUpdateInput> = {}): QuickUpdateInput => ({
  messages: [{ role: "user", text: "finished the Flask dashboard" }],
  steps: [{ id: "st_1", title: "Build a Flask dashboard", kind: "project" }],
  skills: ["SQL"],
  targetRoles: ["Junior data analyst"],
  projects: [],
  canAsk: true,
  ...over,
});

describe("quick-update skill", () => {
  it("puts the open steps, the profile and the question budget in the goal", () => {
    const goal = quickUpdate.buildGoal(input(), toolContext());
    expect(goal).toContain("st_1 [project] Build a Flask dashboard");
    expect(goal).toContain("Skills: SQL");
    expect(goal).toContain("You may ask one clarifying question");
    expect(goal).toContain("Them: finished the Flask dashboard");
    expect(quickUpdate.buildGoal(input({ canAsk: false, steps: [] }), toolContext())).toContain("no questions left");
  });

  it("drops the actions while a question is pending, and drops the question when none is left", () => {
    const asking = { reply: "Which one?", needsAnswer: true, actions: [{ type: "complete_step", stepId: "st_1" }] };
    expect(quickUpdate.finalize!(asking, [], input())).toEqual({ reply: "Which one?", needsAnswer: true, actions: [] });
    expect(quickUpdate.finalize!(asking, [], input({ canAsk: false }))).toEqual({ reply: "Which one?", needsAnswer: false, actions: asking.actions });
    expect(quickUpdate.finalize!({ ...asking, actions: [] }, [], input({ canAsk: false }))).toEqual({ reply: NOTHING_CHANGED, needsAnswer: false, actions: [] });
  });

  it("keeps the reply to 25 words and at most five actions", () => {
    const words = Array.from({ length: 30 }, (_, i) => `w${i}`);
    const actions = Array.from({ length: 7 }, () => ({ type: "add_skill", name: "x" }));
    const out = quickUpdate.finalize!({ reply: words.join(" "), needsAnswer: false, actions }, [], input());
    expect((out.reply as string).split(" ")).toHaveLength(25);
    expect(out.actions).toHaveLength(5);
    expect(capWords("  one two  ", 1)).toBe("one");
  });

  it("stays off private memory in the prompt and holds no tools: the caller supplies the context", () => {
    expect(quickUpdate.personal).toBe(false);
    expect(quickUpdate.tools).toEqual([]);
    expect(quickUpdate.platforms).toEqual(["app"]);
  });
});
