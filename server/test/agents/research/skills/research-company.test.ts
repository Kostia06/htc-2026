import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSkill } from "../../../../src/agents/core/harness";
import { researchCompany } from "../../../../src/agents/research/skills/research-company";
import { call, fakeDeps, fakeServices } from "../../fakes";

const request = { skill: researchCompany, platform: "background" as const, userId: "background", input: { company: "acme" } };

describe("research-company skill", () => {
  beforeEach(async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name, website) VALUES ('c1', 'acme', 'Acme', 'https://acme.com')").run();
  });

  it("runs only in the background and never sees private memory", async () => {
    expect(researchCompany.platforms).toEqual(["background"]);
    const { deps, memoryFor } = fakeDeps({ replies: [call("finish", { summary: "nothing new" })] });
    await runSkill(deps, request);
    expect(memoryFor).not.toHaveBeenCalled();
  });

  it("claims the company's research slot before running", async () => {
    const { deps } = fakeDeps({ services: fakeServices({ claimResearch: vi.fn(async () => false) }) });
    await expect(runSkill(deps, request)).rejects.toMatchObject({ status: 429 });
    expect(deps.services.claimResearch).toHaveBeenCalledWith("acme");
  });

  it("saves facts from pages it read and finishes with a summary", async () => {
    const { deps, conversations } = fakeDeps({
      replies: [
        call("fetch_page", { url: "https://acme.com/careers" }),
        call("save_fact", { kind: "hiring", text: "Acme hires juniors in Calgary", source_url: "https://acme.com/careers" }),
        call("finish", { summary: "Saved 1 fact." }),
      ],
    });
    const result = await runSkill(deps, request);
    expect(result).toMatchObject({ status: "done", output: { summary: "Saved 1 fact." } });
    expect(deps.services.saveFact).toHaveBeenCalledOnce();
    expect(conversations[0][0].parts[0].text).toContain("Acme (https://acme.com)");
  });
});
