import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSkill } from "../../../src/agents/core/harness";
import { interviewIntel } from "../../../src/agents/skills/interview-intel";
import { call, fakeDeps, fakeServices } from "../fakes";

const request = (input: unknown = { company: "acme" }) => ({ skill: interviewIntel, platform: "background" as const, userId: "background", input });

const story = {
  title: "How we hire at Acme",
  url: "https://news.ycombinator.com/item?id=7",
  link: "https://acme.com/blog/how-we-hire",
  author: "pat",
  points: 50,
  created_at: "2026-10-01T00:00:00Z",
  excerpt: "",
};
const thread = { title: "Acme interview?", url: "https://www.reddit.com/r/calgary/comments/9/acme/", snippet: "Had three rounds..." };

describe("interview-intel skill", () => {

  beforeEach(async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name, website) VALUES ('c1', 'acme', 'Acme', 'https://acme.com')").run();
  });

  it("runs only in the background and never sees private memory", async () => {
    expect(interviewIntel.platforms).toEqual(["background"]);
    const { deps, memoryFor } = fakeDeps({ replies: [call("finish", { summary: "nothing new", stages: [] })] });
    await runSkill(deps, request());
    expect(memoryFor).not.toHaveBeenCalled();
  });

  it("runs at most once a day per company, on its own cooldown", async () => {
    const { deps } = fakeDeps({ services: fakeServices({ claimCooldown: vi.fn(async () => false) }) });
    await expect(runSkill(deps, request())).rejects.toMatchObject({ status: 429 });
    expect(deps.services.claimCooldown).toHaveBeenCalledWith("interview-intel", "acme", 86_400_000);
    expect(deps.services.claimResearch).not.toHaveBeenCalled();
  });

  it("saves facts only from pages it read and keeps Reddit as links to anecdotes", async () => {
    const { deps } = fakeDeps({
      services: fakeServices({ hackerNews: vi.fn(async () => [story]), search: vi.fn(async () => [thread]) }),
      replies: [
        call("hn_search", { query: "Acme interview" }),
        call("web_search", { query: "Acme interview experience" }),
        call("fetch_page", { url: "https://acme.com/blog/how-we-hire" }),
        call("save_fact", { kind: "interview_process", text: "A phone screen, then a take-home.", source_url: "https://acme.com/blog/how-we-hire" }),
        call("save_fact", { kind: "interview_process", text: "Three rounds.", source_url: thread.url }),
        call("finish", { summary: "Phone screen, then a take-home.", stages: ["phone screen", "take-home"] }),
      ],
    });
    const result = await runSkill(deps, request());
    if (result.status !== "done") throw new Error(result.error);
    expect(deps.services.saveFact).toHaveBeenCalledOnce();
    expect(deps.services.fetchPage).toHaveBeenCalledOnce();
    expect(result.output).toMatchObject({
      factsSaved: 1,
      sources: ["https://acme.com/blog/how-we-hire"],
      anecdotes: [story.url, thread.url],
    });
    expect(JSON.stringify(result.output)).not.toContain(thread.snippet);
  });

  it("names the role in the goal when one is given", () => {
    const goal = interviewIntel.buildGoal({ company: "acme", role: "Data Analyst" }, { company: { id: "c1", slug: "acme", name: "Acme", website: null } } as never);
    expect(goal).toContain("Acme");
    expect(goal).toContain("Data Analyst");
  });
});
