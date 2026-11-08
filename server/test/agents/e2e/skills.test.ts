import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { agents } from "../../../src/agents/core/registry";
import { findRun } from "../../../src/agents/core/runs";
import { orchestrate } from "../../../src/agents/orchestrator";
import { call, fakeDeps, fakeMemory } from "../fakes";
import { fixtures } from "./fixtures";

const SECRET = "private goal: leave my current employer quietly";
const allSkills = agents.flatMap((agent) => Object.values(agent.skills).map((skill) => ({ agent, skill })));
const allTools = [...new Set(agents.flatMap((a) => Object.keys(a.tools)))];

beforeEach(async () => {
  await env.DB.prepare("INSERT INTO companies (id, slug, name, website, tracked) VALUES ('c1', 'acme', 'Acme', 'https://acme.com', 0)").run();
});

describe("every registered skill, end to end through the orchestrator", () => {
  it("has a fixture for each skill and nothing else", () => {
    expect(Object.keys(fixtures).sort()).toEqual(allSkills.map((s) => s.skill.name).sort());
  });

  for (const { agent, skill } of allSkills) {
    for (const platform of skill.platforms) {
      it(`${agent.card.name}/${skill.name} on ${platform} finishes and is recorded for its user`, async () => {
        const { input, output } = fixtures[skill.name];
        const memory = fakeMemory([{ kind: "goal", text: SECRET }]);
        const { deps, toolNames, prompts, memoryFor } = fakeDeps({ memory, replies: [call("finish", output)] });
        const run = await orchestrate(deps, { skillId: skill.name, platform, userId: "u-e2e", input });
        expect(run).toMatchObject({ status: "done" });
        expect(toolNames[0]).toEqual([...skill.tools, "finish"]);
        expect((await findRun(env, run.runId, "u-e2e"))?.status).toBe("done");
        expect(await findRun(env, run.runId, "someone-else")).toBeNull();
        // only personal skills may see private memory, in the prompt or through the port
        expect(memoryFor.mock.calls.length > 0).toBe(skill.personal);
        expect(prompts[0].includes(SECRET)).toBe(skill.personal);
      });
    }
  }

  for (const { agent, skill } of allSkills) {
    const outsider = allTools.find((name) => !skill.tools.includes(name))!;
    it(`${skill.name} cannot reach ${outsider}, a tool it was not given`, async () => {
      const { input, output } = fixtures[skill.name];
      const { deps } = fakeDeps({ replies: [call(outsider, { company: "acme", query: "x", text: "x", kind: "note" }), call("finish", output)] });
      const run = await orchestrate(deps, { skillId: skill.name, platform: skill.platforms[0], userId: "u1", input });
      const rejected = run.toolCalls.find((c) => c.name === outsider);
      expect(rejected?.result).toEqual({ error: `unknown tool ${outsider}` });
      expect(run.status).toBe("done");
      expect(deps.services.saveFact).not.toHaveBeenCalled();
      expect(Object.hasOwn(agent.tools, outsider) && skill.tools.includes(outsider)).toBe(false);
    });
  }

  it("gives each skill only tools its own agent holds", () => {
    for (const { agent, skill } of allSkills) for (const name of skill.tools) expect(Object.hasOwn(agent.tools, name)).toBe(true);
  });

  it("keeps background-only skills off the app and app-only skills off the headset", async () => {
    const { deps } = fakeDeps();
    for (const { skill } of allSkills) {
      for (const platform of (["app", "vr", "background"] as const).filter((p) => !skill.platforms.includes(p))) {
        await expect(orchestrate(deps, { skillId: skill.name, platform, userId: "u1", input: fixtures[skill.name].input })).rejects.toMatchObject({ status: 400 });
      }
    }
  });
});
