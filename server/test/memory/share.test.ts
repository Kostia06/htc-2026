import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deps } from "../../src/memory/experiences";
import { listMemories, remember } from "../../src/memory/private/store";
import { shareMemory } from "../../src/memory/share";

const target = { companySlug: "acme", role: "Junior Developer" };

async function sharedExperiences() {
  const { results } = await env.DB.prepare("SELECT role, questions_json FROM experiences").all<{ role: string; questions_json: string }>();
  return results;
}

describe("shareMemory", () => {
  beforeEach(async () => {
    vi.spyOn(deps, "scrubNames").mockImplementation(async (_env, fields) =>
      Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.replace(/\bAlice\b/g, "[name]")])),
    );
    vi.spyOn(deps, "upsertVector").mockResolvedValue();
    await env.DB.prepare("INSERT OR IGNORE INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')").run();
  });

  it("publishes a scrubbed copy of a note and keeps the private memory", async () => {
    const note = await remember(env, "alice", { kind: "note", text: "Alice was asked to design a URL shortener, mail alice@example.com" });

    expect(await shareMemory(env, "alice", note.id, target)).toEqual({ shared: true });

    const [experience] = await sharedExperiences();
    expect(experience.role).toBe("Junior Developer");
    expect(JSON.parse(experience.questions_json)).toEqual(["[name] was asked to design a URL shortener, mail [email]"]);
    expect(deps.scrubNames).toHaveBeenCalled();
    expect(await listMemories(env, "alice")).toHaveLength(1);
  });

  it("only shares notes", async () => {
    const weakness = await remember(env, "alice", { kind: "weakness", text: "Nervous in salary talks" });
    expect(await shareMemory(env, "alice", weakness.id, target)).toEqual({ shared: false, reason: "not_a_note" });
    expect(await sharedExperiences()).toEqual([]);
  });

  it("cannot share someone else's memory", async () => {
    const note = await remember(env, "alice", { kind: "note", text: "Asked about Kafka" });
    expect(await shareMemory(env, "bob", note.id, target)).toEqual({ shared: false, reason: "not_found" });
    expect(await sharedExperiences()).toEqual([]);
  });

  it("passes on why the experience was refused", async () => {
    const note = await remember(env, "alice", { kind: "note", text: "Asked about Kafka" });
    expect(await shareMemory(env, "alice", note.id, { ...target, companySlug: "nope" })).toEqual({ shared: false, reason: "unknown_company" });
  });
});
