import { describe, expect, it } from "vitest";
import { agents, cards, findSkill } from "../../../src/agents/core/registry";
import { PLATFORMS } from "../../../src/agents/core/types";
import { companyFacts } from "../../../src/agents/shared-tools/company-facts";
import { companyInsights } from "../../../src/agents/shared-tools/company-insights";
import { fetchPage } from "../../../src/agents/shared-tools/fetch-page";
import { githubProfile } from "../../../src/agents/shared-tools/github-profile";
import { readProfile, updateProfileTool } from "../../../src/agents/shared-tools/profile";
import { recall } from "../../../src/agents/shared-tools/recall";
import { saveFact } from "../../../src/agents/shared-tools/save-fact";
import { webSearch } from "../../../src/agents/shared-tools/web-search";

const SHARED = new Set([companyFacts, companyInsights, fetchPage, githubProfile, readProfile, updateProfileTool, recall, saveFact, webSearch].map((t) => t.name));
const allSkills = () => agents.flatMap((a) => Object.values(a.skills));

describe("agent registry", () => {
  it("has every skill exactly once, across four agents", () => {
    expect(agents.map((a) => a.card.name)).toEqual(["resume", "research", "interview", "career"]);
    expect(allSkills().map((s) => s.name).sort()).toEqual([
      "career-snapshot", "crossroads-ask", "github-projects", "import-posting", "interview-debrief", "interview-intel", "interview-prep", "interview-recap",
      "onboarding-prefill", "profile-intake", "quick-update", "recommend-courses", "recommend-jobs", "recommend-research", "research-company", "resume-coach", "resume-tailor", "roadmap-steps",
    ]);
  });

  it("finds a skill with the agent that owns it", () => {
    const found = findSkill("interview-prep");
    expect(found?.agent.card.name).toBe("interview");
    expect(found?.skill.name).toBe("interview-prep");
  });

  it("finds nothing for unknown ids, including object built-ins", () => {
    expect(findSkill("nope")).toBeUndefined();
    expect(findSkill("toString")).toBeUndefined();
  });

  it("lists one card per agent, with that agent's skills", () => {
    expect(cards().map((c) => c.name)).toEqual(agents.map((a) => a.card.name));
    for (const agent of agents) expect(agent.card.skills.map((s) => s.id).sort()).toEqual(Object.keys(agent.skills).sort());
  });

  it("only lets two agents hold the same tool when it lives in shared-tools", () => {
    const holders = new Map<string, string[]>();
    for (const agent of agents) {
      for (const name of Object.keys(agent.tools)) holders.set(name, [...(holders.get(name) ?? []), agent.card.name]);
    }
    for (const [name, owners] of holders) {
      if (owners.length > 1) expect(SHARED.has(name), `${name} is held by ${owners.join(", ")}`).toBe(true);
    }
  });

  it("only uses known platforms", () => {
    for (const skill of allSkills()) for (const platform of skill.platforms) expect(PLATFORMS).toContain(platform);
  });

  it("keeps private memory tools out of skills that aren't personal", () => {
    for (const skill of allSkills().filter((s) => !s.personal)) {
      expect(skill.tools).not.toContain("recall");
      expect(skill.tools).not.toContain("remember");
    }
  });

  it("keeps finish out of every toolbox, since each skill gets its own", () => {
    for (const agent of agents) expect(agent.tools.finish).toBeUndefined();
  });
});
