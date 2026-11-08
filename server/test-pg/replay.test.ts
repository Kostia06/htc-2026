// The replay store on Postgres: the same SQL the Worker ships, through db(env).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { queueLaunch, takeLaunch } from "../src/headset/launch";
import {
  attachConversation,
  attachReconnect,
  conversationOf,
  conversationsBefore,
  conversationsOfUser,
  deleteSession,
  loadReplayRecord,
  recordingsOf,
  saveReport,
} from "../src/replay/store";
import { fallbackDebrief } from "../src/voice/debrief";
import { claimLiveTip, countSessionsWithIssue, saveDeliveryIssues } from "../src/voice/coach/session-store";
import { addTurn, createSession, findSession, listTurns, saveLiveTip } from "../src/voice/store";
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
    expect(await attachReconnect(env, "alice", id, "conv_3")).toBe(true);
    expect(await attachReconnect(env, "bob", id, "conv_4")).toBe(false);
    expect(await recordingsOf(env, "alice", id)).toEqual(["conv_1", "conv_3"]);
    expect(await conversationsOfUser(env, "alice")).toEqual(["conv_1", "conv_3"]);
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

  it("queues a headset review of a past session", async () => {
    await queueLaunch(env, "alice", { mode: "interview", reviewSessionId: "s_1" }, NOW);
    await queueLaunch(env, "alice", { mode: "interview", reviewSessionId: "s_2" }, NOW);
    expect(await takeLaunch(env, "alice", new Date(NOW.getTime() + 1000))).toEqual({ mode: "interview", reviewSessionId: "s_2" });
  });

  it("keeps live timestamps, one sealed tip per session and the delivery habits", async () => {
    const id = await createSession(env, "alice", { mode: "interview", companySlug: null, plan }, NOW);
    const score = { scores: { structure: 1 }, delivery: { words: 9, fillerWords: 0, wordsPerMinute: null }, tip: "t" };
    expect(await addTurn(env, "alice", id, { question: "q", answer: "a", score, timing: { answerStartSec: 4.25, atSec: 9 } })).toBe(0);
    expect(await addTurn(env, "alice", id, { question: "q2", answer: "b", score })).toBe(1);
    expect(await claimLiveTip(env, "bob", id)).toBe(false);
    expect(await claimLiveTip(env, "alice", id)).toBe(true);
    expect(await claimLiveTip(env, "alice", id)).toBe(false);
    const tip = { kind: "coaching" as const, said: "a", rewrite: "better", why: "because", sources: [] };
    await saveLiveTip(env, "alice", id, 0, tip);
    const turns = await listTurns(env, "alice", id);
    expect(turns[0]).toMatchObject({ answerStartSec: 4.25, atSec: 9, liveTip: tip });
    expect(turns[1].answerStartSec).toBeUndefined();

    await saveDeliveryIssues(env, "alice", id, ["we", "no_result"]);
    expect(await countSessionsWithIssue(env, "alice", "we")).toBe(1);
    expect(await countSessionsWithIssue(env, "alice", "hedging")).toBe(0);
    expect(await countSessionsWithIssue(env, "bob", "we")).toBe(0);
  });
});
