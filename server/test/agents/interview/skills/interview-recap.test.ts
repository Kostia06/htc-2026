import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { runSkill } from "../../../../src/agents/core/harness";
import { interviewAgent } from "../../../../src/agents/interview/agent";
import { interviewRecap, summaryReply } from "../../../../src/agents/interview/skills/interview-recap";
import { call, fakeDeps } from "../../fakes";

const request = (input: unknown) => ({ skill: interviewRecap, tools: interviewAgent.tools, platform: "app" as const, userId: "u1", input });

const opening = { role: "raven" as const, text: "How did your interview go?" };
const full = { role: "user" as const, text: "ATB technical round for a junior data analyst. They asked me to explain a left join and how I'd find a slow query." };
const vague = { role: "user" as const, text: "It went okay I think, pretty nervous." };

const complete = { company: "ATB", role: "Junior data analyst", round: "technical", questions: ["Explain a left join", "How would you find a slow query?"] };
const asksCompany = call("finish", { done: false, reply: "Which company was it?", extracted: { questions: [] } });

describe("interview-recap skill", () => {
  beforeEach(async () => {
    await env.DB.prepare("INSERT OR IGNORE INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')").run();
  });

  it("runs only on the app, with no tools but finish, so it stays fast", () => {
    expect(interviewRecap.platforms).toEqual(["app"]);
    expect(interviewRecap.tools).toEqual([]);
    expect(interviewRecap.personal).toBe(false);
  });

  it("puts the conversation, the company and the question budget in the goal", async () => {
    const { deps, conversations, toolNames } = fakeDeps({ replies: [asksCompany] });
    await runSkill(deps, request({ company: "acme", messages: [opening, vague], questionsLeft: 2 }));
    const goal = conversations[0][0].parts[0].text!;
    expect(goal).toContain("interviewed at Acme");
    expect(goal).toContain("2 clarifying questions");
    expect(goal).toContain("Them: It went okay");
    expect(toolNames[0]).toEqual(["finish"]);
  });

  it("asks one clarifying question when something essential is missing", async () => {
    const { deps } = fakeDeps({ replies: [asksCompany] });
    const result = await runSkill(deps, request({ messages: [opening, vague], questionsLeft: 2 }));
    expect(result).toMatchObject({ status: "done", output: { done: false, reply: "Which company was it?" } });
  });

  it("never asks when company, role and questions are already there", async () => {
    const { deps } = fakeDeps({ replies: [call("finish", { done: false, reply: "Which round was it?", extracted: complete })] });
    const result = await runSkill(deps, request({ messages: [opening, full], questionsLeft: 2 }));
    expect(result.status).toBe("done");
    if (result.status !== "done") return;
    expect(result.output.done).toBe(true);
    expect(result.output.reply).toBe("Got it: 2 questions from ATB's technical round. I'll share them anonymously.");
  });

  it("counts a known company slug as the company", async () => {
    const { deps } = fakeDeps({ replies: [call("finish", { done: false, reply: "Which company?", extracted: { ...complete, company: undefined } })] });
    const result = await runSkill(deps, request({ company: "acme", messages: [opening, full], questionsLeft: 2 }));
    expect(result.status === "done" && result.output.done).toBe(true);
  });

  it("finishes with what exists once the clarifying questions are used up", async () => {
    const { deps } = fakeDeps({ replies: [call("finish", { done: false, reply: "What role was it for?", extracted: { company: "ATB", questions: ["Explain a left join"] } })] });
    const result = await runSkill(deps, request({ messages: [opening, vague, { role: "raven", text: "Which company?" }, { role: "user", text: "ATB" }], questionsLeft: 0 }));
    expect(result).toMatchObject({ status: "done", output: { done: true, extracted: { company: "ATB", questions: ["Explain a left join"] } } });
    if (result.status === "done") expect(result.output.reply).toContain("1 question from ATB's interview");
  });

  it("keeps the model's warm reply and note when it finishes on its own", async () => {
    const reply = "Got it: 2 questions from ATB's technical round. I'll share them anonymously.";
    const { deps } = fakeDeps({ replies: [call("finish", { done: true, reply, extracted: complete, note: "Interviewed at ATB, technical round, struggled with SQL joins" })] });
    const result = await runSkill(deps, request({ messages: [opening, full], questionsLeft: 2 }));
    expect(result).toMatchObject({ status: "done", output: { done: true, reply, extracted: complete, note: "Interviewed at ATB, technical round, struggled with SQL joins" } });
  });

  it("drops blank questions and rejects a run with no messages", async () => {
    const { deps } = fakeDeps({ replies: [call("finish", { done: true, reply: "Thanks!", extracted: { ...complete, questions: ["  ", "Explain a left join"] } })] });
    const result = await runSkill(deps, request({ messages: [full], questionsLeft: 2 }));
    expect(result.status === "done" && result.output.extracted).toEqual({ ...complete, questions: ["Explain a left join"] });
    await expect(runSkill(deps, request({ messages: [], questionsLeft: 2 }))).rejects.toMatchObject({ status: 400 });
  });

  it("writes the wrap-up line from what was extracted", () => {
    expect(summaryReply({ questions: ["a", "b", "c"], company: "ATB", round: "Technical round" })).toBe("Got it: 3 questions from ATB's technical round. I'll share them anonymously.");
    expect(summaryReply({ questions: [], company: "ATB" })).toBe("Got it. Thanks for telling me how it went at ATB. I've kept a note for you.");
    expect(summaryReply({ questions: ["a"], round: "phone screen" })).toBe("Got it: 1 question from your phone screen round. I'll share them anonymously.");
  });
});
