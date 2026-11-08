import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { listMemories } from "../../src/memory/private/store";
import { loadAll } from "../../src/roadmap/store";
import { notePatterns } from "../../src/voice/coach/patterns";
import { measureDelivery } from "../../src/voice/delivery";
import { createSession, type StoredTurn } from "../../src/voice/store";
import type { InterviewPlan } from "../../src/voice/types";

const plan: InterviewPlan = { mode: "interview", role: "Developer", company: null, questions: [] };
const TEAM = "We built it, we shipped it and our users liked what we made.";
const teamTurn: StoredTurn = { idx: 0, question: "Tell me about a project.", answer: TEAM, scores: {}, delivery: measureDelivery(TEAM, 0), tip: "t" };

async function finishedSession(userId: string) {
  const id = await createSession(env, userId, { mode: "interview", companySlug: null, plan });
  await notePatterns(env, userId, id, [teamTurn]);
}

describe("delivery patterns across sessions", () => {
  it("turns a habit seen in three sessions into one private note and one Road step, once", async () => {
    const userId = `u_${crypto.randomUUID()}`;
    await finishedSession(userId);
    await finishedSession(userId);
    expect(await loadAll(env, userId)).toEqual([]);

    await finishedSession(userId);
    await finishedSession(userId);
    const steps = await loadAll(env, userId);
    expect(steps.map((s) => s.title)).toEqual(["Practise answering with I, not we"]);
    expect(steps[0]).toMatchObject({ kind: "interview_practice", action: { type: "interview" } });
    const notes = await listMemories(env, userId);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ kind: "weakness" });
  });

  it("counts only the person's own sessions", async () => {
    const [alice, bob] = [`u_${crypto.randomUUID()}`, `u_${crypto.randomUUID()}`];
    await finishedSession(alice);
    await finishedSession(alice);
    await finishedSession(bob);
    expect(await loadAll(env, bob)).toEqual([]);
    expect(await loadAll(env, alice)).toEqual([]);
  });
});
