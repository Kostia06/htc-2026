import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Profile } from "../../src/memory/profile/types";
import { emptyProfile } from "../../src/memory/profile/patch";
import { ensureResumeSteps, resumeSteps } from "../../src/roadmap/prefill";
import { countSteps, loadAll, loadCompleted } from "../../src/roadmap/store";
import { personFor, templateSteps } from "../../src/roadmap/templates";

const strong = (): Profile => ({
  ...emptyProfile(),
  targetRoles: ["Junior data analyst"],
  experience: [
    { role: "Data analyst intern", org: "ATB Financial", start: "2025", end: "2025", highlights: ["Built a loan dashboard in Tableau", "Cut a weekly report from 3 h to 20 min"] },
    { role: "Volunteer tutor", org: "Calgary Public Library", highlights: [] },
  ],
  projects: [{ name: "Transit delay predictor", summary: "Python model on Calgary Transit data" }],
  certifications: ["Google Data Analytics"],
});

describe("resumeSteps", () => {
  it("turns a resume into finished steps, in resume order", () => {
    const steps = resumeSteps(strong());
    expect(steps.map((s) => [s.kind, s.title])).toEqual([
      ["project", "Data analyst intern at ATB Financial"],
      ["volunteering", "Volunteer tutor at Calgary Public Library"],
      ["project", "Transit delay predictor"],
      ["certification", "Google Data Analytics"],
    ]);
    expect(steps[0].why).toBe("From your resume");
    expect(steps[0].note).toBe("Built a loan dashboard in Tableau");
    expect(steps[2].detail).toBe("Python model on Calgary Transit data");
  });

  it("gives an empty resume nothing to prefill", () => {
    expect(resumeSteps(emptyProfile())).toEqual([]);
  });

  it("caps how much of a long resume lands on the road", () => {
    const profile = { ...emptyProfile(), projects: Array.from({ length: 20 }, (_, i) => ({ name: `Project ${i}` })) };
    expect(resumeSteps(profile)).toHaveLength(8);
  });
});

describe("ensureResumeSteps", () => {
  it("adds the resume as done steps once, before the plan", async () => {
    const userId = `u_${crypto.randomUUID()}`;
    expect(await ensureResumeSteps(env, userId, strong())).toBe(true);
    expect(await ensureResumeSteps(env, userId, strong())).toBe(false);

    const counts = await countSteps(env, userId);
    expect(counts).toEqual({ total: 4, done: 4, open: 0 });
    const done = await loadCompleted(env, userId);
    expect(done.every((s) => s.completedAt)).toBe(true);
    expect((await loadAll(env, userId))[0].title).toBe("Data analyst intern at ATB Financial");
  });

  it("does nothing until there is something on the resume", async () => {
    const userId = `u_${crypto.randomUUID()}`;
    expect(await ensureResumeSteps(env, userId, emptyProfile())).toBe(false);
    expect((await countSteps(env, userId)).total).toBe(0);
  });
});

describe("head start", () => {
  it("skips the first starter project for someone who has already built things", () => {
    const fresh = templateSteps(personFor("Software developer", ["Python"]), 0, 2);
    const experienced = templateSteps(personFor("Software developer", ["Python"], true), 0, 2);
    expect(fresh[0].kind).toBe("project");
    expect(experienced[0].title).toBe(fresh[1].title);
  });

  it("never skips a networking-first plan", () => {
    const fresh = templateSteps(personFor("Registered nurse", []), 0, 1);
    const experienced = templateSteps(personFor("Registered nurse", [], true), 0, 1);
    expect(experienced[0].title).toBe(fresh[0].title);
  });
});
