import { describe, expect, it } from "vitest";
import { runSkill } from "../../../../src/agents/core/harness";
import { resumeAgent } from "../../../../src/agents/resume/agent";
import { resumeCoach } from "../../../../src/agents/resume/skills/resume-coach";
import { sampleResume } from "../../../resume/fixtures";
import { call, fakeDeps, toolContext } from "../../fakes";

const input = { resume: sampleResume, targetRole: "Junior data analyst" };

describe("resume-coach skill", () => {
  it("runs in the app with the person's memory and the tools it needs", () => {
    expect(resumeCoach.platforms).toEqual(["app"]);
    expect(resumeCoach.personal).toBe(true);
    for (const tool of resumeCoach.tools) expect(resumeAgent.tools).toHaveProperty(tool);
  });

  it("puts the editable lines in the goal with their paths, never the contact details", () => {
    const goal = resumeCoach.buildGoal(input, toolContext({ company: undefined }));
    expect(goal).toContain("Target role: Junior data analyst.");
    expect(goal).toContain("experience[0].bullets[0]: Worked on a Python Flask API");
    expect(goal).toContain("summary: Third-year computer science student");
    expect(goal).not.toContain("jordan@example.com");
    expect(goal).not.toContain("Jordan Lee");
    expect(goal).not.toContain("403-555");
  });

  it("narrows the goal to one section and names the company when one is set", () => {
    const goal = resumeCoach.buildGoal({ ...input, section: "projects" }, toolContext());
    expect(goal).toContain("Applying to Acme.");
    expect(goal).toContain("projects[0].bullets[0]");
    expect(goal).not.toContain("experience[0]");
  });

  it("hands back only verified suggestions from a full run", async () => {
    const { deps } = fakeDeps({
      replies: [
        call("finish", {
          suggestions: [
            { path: "experience[0].bullets[0]", before: "Worked on a Python Flask API", after: "Built a Python Flask API serving 5,000 users", why: "Outcome." },
            { path: "experience[0].bullets[7]", before: "nope", after: "Invented", why: "" },
          ],
        }),
      ],
    });
    const result = await runSkill(deps, { skill: resumeCoach, tools: resumeAgent.tools, platform: "app", userId: "u1", input });
    expect(result.status).toBe("done");
    if (result.status !== "done") return;
    expect(result.output.suggestions).toEqual([
      { path: "experience[0].bullets[0]", before: "Worked on a Python Flask API", after: "Built a Python Flask API serving [add number] users", why: "Outcome." },
    ]);
  });

  it("rejects input without a resume", async () => {
    const { deps } = fakeDeps();
    await expect(runSkill(deps, { skill: resumeCoach, tools: resumeAgent.tools, platform: "app", userId: "u1", input: {} })).rejects.toMatchObject({ status: 400 });
  });
});
