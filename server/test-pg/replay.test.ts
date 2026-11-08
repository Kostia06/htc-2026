// The replay store on Postgres: the same SQL the Worker ships, through db(env).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { attachConversation, conversationOf, conversationsBefore, conversationsOfUser, deleteSession, loadReplayRecord, saveReport } from "../src/replay/store";
import { fallbackDebrief } from "../src/voice/debrief";
import { addTurn, createSession, findSession } from "../src/voice/store";
import { openTestDatabase } from "./pglite";

let db: Awaited<ReturnType<typeof openTestDatabase>>;
let env: Env;
const NOW = new Date("2026-06-01T00:00:00.000Z");
const plan = { mode: "interview", role: "Dev", company: null, questions: [] } as never;

beforeAll(async () => {
  db = await openTestDatabase();
  env = db.env;
});
afterAll(() => db.pg.close());
beforeEach(async () => {
  await db.pg.exec("DELETE FROM voice_turns; DELETE FROM voice_sessions");
});

describe("replay store", () => {
  it("links a conversation once, per owner, and finds old ones for the sweep", async () => {
    const id = await createSession(env, "alice", { mode: "interview", companySlug: null, plan }, NOW);
    expect(await attachConversation(env, "bob", id, "conv_1")).toBe(false);
    expect(await attachConversation(env, "alice", id, "conv_1")).toBe(true);
    expect(await attachConversation(env, "alice", id, "conv_2")).toBe(false);
    expect(await conversationOf(env, "alice", id)).toBe("conv_1");
    expect(await conversationsOfUser(env, "alice")).toEqual(["conv_1"]);
    expect(await conversationsOfUser(env, "bob")).toEqual([]);
    expect(await conversationsBefore(env, new Date(NOW.getTime() + 1000).toISOString())).toEqual(["conv_1"]);
  });

  it("seals the report and reads it back for the owner only", async () => {
    const id = await createSession(env, "alice", { mode: "interview", companySlug: null, plan }, NOW);
    const score = { scores: { structure: 3 }, delivery: { words: 9, fillerWords: 0, wordsPerMinute: null }, tip: "t" };
    await addTurn(env, "alice", id, { question: "q", answer: "a long enough answer to count as one", score });
    const report = fallbackDebrief([{ idx: 0, question: "q", answer: "a long enough answer to count as one", ...score }]);
    await saveReport(env, "alice", id, report);
    expect((await loadReplayRecord(env, "alice", id)).report).toEqual(report);
    expect(await loadReplayRecord(env, "bob", id)).toEqual({ conversationId: null, report: null });
    await deleteSession(env, "alice", id);
    expect(await findSession(env, "alice", id)).toBeNull();
  });
});
