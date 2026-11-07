import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { buildInterviewPlan } from "../../src/voice/plan";
import { addTurn, createSession, deleteOldSessions, findSession, finishSession, listTurns } from "../../src/voice/store";
import { inputs } from "./fixtures";

const plan = buildInterviewPlan(inputs());
const score = { scores: { structure: 3 }, delivery: { words: 4, fillerWords: 0, wordsPerMinute: 120 }, tip: "Add a number." };

describe("voice store", () => {
  it("keeps a session and its turns for the person who had it, and nobody else", async () => {
    const id = await createSession(env, "owner", { mode: "interview", companySlug: "acme", plan });
    await addTurn(env, "owner", id, { question: "Q1", answer: "My answer", score });

    expect(await findSession(env, "owner", id)).toMatchObject({ mode: "interview", status: "active", plan });
    expect(await listTurns(env, "owner", id)).toEqual([{ idx: 0, question: "Q1", answer: "My answer", ...score }]);
    expect(await findSession(env, "intruder", id)).toBeNull();
    expect(await listTurns(env, "intruder", id)).toEqual([]);
  });

  it("stores what was said only as ciphertext", async () => {
    const id = await createSession(env, "owner", { mode: "interview", companySlug: null, plan });
    await addTurn(env, "owner", id, { question: "Q1", answer: "My secret salary is 90k", score });
    const row = await env.DB.prepare("SELECT ciphertext FROM voice_turns WHERE session_id = ?").bind(id).first<{ ciphertext: string }>();
    expect(row?.ciphertext).not.toContain("salary");
  });

  it("deletes sessions after 30 days", async () => {
    const old = await createSession(env, "owner", { mode: "networking", companySlug: null, plan }, new Date("2026-09-01T00:00:00Z"));
    await finishSession(env, "owner", old);
    expect(await deleteOldSessions(env, new Date("2026-11-08T00:00:00Z"))).toBeGreaterThanOrEqual(1);
    expect(await findSession(env, "owner", old)).toBeNull();
  });
});
