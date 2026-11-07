import { describe, expect, it } from "vitest";
import { runSkill } from "../../../src/agents/core/harness";
import { interviewDebrief } from "../../../src/agents/skills/interview-debrief";
import { call, fakeDeps, fakeMemory } from "../fakes";

const answers = [
  { question: "Tell me about yourself", answer: "I like code.", score: 4, feedback: "Too short" },
  { question: "How do you test?", answer: "I don't really.", score: 3 },
];
const request = (input: unknown) => ({ skill: interviewDebrief, platform: "app" as const, userId: "u1", input });
const finish = { summary: "Short answers held you back.", prepList: [{ step: "Practise STAR answers", why: "Both answers lacked detail." }] };

describe("interview-debrief skill", () => {
  it("runs on the app and in VR", () => {
    expect(interviewDebrief.platforms).toEqual(["app", "vr"]);
  });

  it("needs the scored answers", async () => {
    const { deps } = fakeDeps();
    await expect(runSkill(deps, request({ answers: [] }))).rejects.toMatchObject({ status: 400 });
    await expect(runSkill(deps, request({ answers: [{ question: "q", answer: "a" }] }))).rejects.toMatchObject({ status: 400 });
  });

  it("puts the answers in the goal as data", async () => {
    const { deps, conversations } = fakeDeps({ replies: [call("finish", finish)] });
    await runSkill(deps, request({ answers }));
    const goal = conversations[0][0].parts[0].text!;
    expect(goal).toContain("How do you test?");
    expect(goal).toContain("score 3/10");
  });

  it("saves recurring weak spots to private memory and counts only real saves", async () => {
    const memory = fakeMemory();
    const { deps } = fakeDeps({
      memory,
      replies: [
        call("recall", { kinds: ["weakness", "skill"] }),
        call("remember", { kind: "weakness", text: "Gives short answers without examples" }),
        call("remember", { kind: "nonsense", text: "x" }),
        call("finish", { ...finish, savedToMemory: 9 }),
      ],
    });
    const result = await runSkill(deps, request({ answers }));
    expect(result).toMatchObject({ status: "done", output: { ...finish, savedToMemory: 1 } });
    expect(memory.items.map((m) => m.text)).toEqual(["Gives short answers without examples"]);
  });
});
