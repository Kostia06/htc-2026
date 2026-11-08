import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { me } from "../../src/api/me";
import { replayRouter } from "../../src/api/replay";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";
import { deps } from "../../src/replay/elevenlabs";
import { saveReport } from "../../src/replay/store";
import { fallbackDebrief } from "../../src/voice/debrief";
import { addTurn, createSession, findSession, listTurns } from "../../src/voice/store";
import type { InterviewPlan } from "../../src/voice/types";

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.route("/me", me);
app.route("/", replayRouter());

const configured = { ...env, ELEVENLABS_API_KEY: "xi-test", ELEVENLABS_AGENT_ID: "agent_1" };
const plan: InterviewPlan = { mode: "interview", role: "Developer", company: null, questions: [] };
const delivery = { words: 12, fillerWords: 0, wordsPerMinute: 120 };
const weak = { scores: { structure: 2, relevance: 2, specificity: 1, confidence: 2 }, delivery, tip: "Add one concrete detail." };
const strong = { scores: { structure: 5, relevance: 5, specificity: 5, confidence: 5 }, delivery, tip: "Keep going." };

const details = {
  agent_id: "agent_1",
  status: "done",
  has_audio: true,
  metadata: { call_duration_secs: 90 },
  transcript: [
    { role: "agent", message: "[warmly] Tell me about a project.", time_in_call_secs: 0 },
    { role: "user", message: "I rebuilt our reporting pipeline at ATB.", time_in_call_secs: 8 },
    { role: "agent", message: "Why our team?", time_in_call_secs: 40 },
    { role: "user", message: "I think fintech is interesting.", time_in_call_secs: 47 },
    { role: "agent", message: null, time_in_call_secs: 60 },
  ],
};

type Who = { token: string; id: string };
async function person(): Promise<Who> {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, id: (await verifySession(token, env.SESSION_SECRET))! };
}
const call = (who: Who, path: string, init: RequestInit = {}, bindings = configured) =>
  app.request(path, { ...init, headers: { Authorization: `Bearer ${who.token}`, "Content-Type": "application/json", ...init.headers } }, bindings);
const attach = (who: Who, id: string, conversationId: unknown) => call(who, `/${id}/conversation`, { method: "POST", body: JSON.stringify({ conversationId }) });

async function sessionWithTurns(who: Who) {
  const id = await createSession(env, who.id, { mode: "interview", companySlug: null, plan });
  await addTurn(env, who.id, id, { question: "Tell me about a project.", answer: "I rebuilt our reporting pipeline at ATB.", score: strong });
  await addTurn(env, who.id, id, { question: "Why our team?", answer: "I think fintech is interesting.", score: weak });
  return id;
}

const realFetch = deps.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
const elevenLabsCalls = () => (fetchMock.mock.calls as unknown as [string, RequestInit | undefined][]).map(([url, init]) => `${init?.method ?? "GET"} ${url}`);

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM voice_turns"), env.DB.prepare("DELETE FROM voice_sessions")]);
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") return Response.json({});
    if (url.endsWith("/audio")) return new Response("ID3audio", { headers: { "Content-Type": "audio/mpeg" } });
    return Response.json(details);
  });
  deps.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  deps.fetch = realFetch;
});

describe("replay without a recording", () => {
  it("falls back to the stored transcript, timed by answer order, with no audio", async () => {
    const who = await person();
    const id = await sessionWithTurns(who);
    const res = await call(who, `/${id}/replay`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("private");
    const body = await res.json<{ audioUrl: null; timing: string; recording: string; moments: { t: number; kind: string }[]; transcript: unknown[] }>();
    expect(body).toMatchObject({ audioUrl: null, timing: "order", recording: "none", durationSec: null });
    expect(body.moments.map((m) => [m.t, m.kind])).toEqual([
      [0, "strength"],
      [1, "mistake"],
    ]);
    expect(body.transcript).toHaveLength(4);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("replay with an ElevenLabs recording", () => {
  it("puts each moment at the second it was said and points at the audio proxy", async () => {
    const who = await person();
    const id = await sessionWithTurns(who);
    expect((await attach(who, id, "conv_abc123")).status).toBe(200);
    await saveReport(env, who.id, id, fallbackDebrief(await listTurns(env, who.id, id)));

    const body = await (await call(who, `/${id}/replay`)).json<{ audioUrl: string; timing: string; durationSec: number; moments: { t: number; kind: string }[]; transcript: { text: string }[] }>();
    expect(body).toMatchObject({ audioUrl: `/api/voice/sessions/${id}/replay/audio`, timing: "seconds", recording: "ready", durationSec: 90 });
    // the scores-only report suggests a fix for every answer; dots on the same second are nudged apart
    expect(body.moments.map((m) => [m.t, m.kind])).toEqual([
      [8, "better"],
      [9, "strength"],
      [47, "mistake"],
      [48, "better"],
    ]);
    expect(body.transcript[0].text).toBe("Tell me about a project.");
    expect(elevenLabsCalls()).toEqual(["GET https://api.elevenlabs.io/v1/convai/conversations/conv_abc123"]);
  });

  it("treats a conversation from another agent, or one ElevenLabs can't serve, as no recording", async () => {
    const who = await person();
    const id = await sessionWithTurns(who);
    await attach(who, id, "conv_other");
    deps.fetch = (async () => Response.json({ ...details, agent_id: "someone_else" })) as typeof fetch;
    expect(await (await call(who, `/${id}/replay`)).json()).toMatchObject({ audioUrl: null, timing: "order" });
    deps.fetch = (async () => new Response("down", { status: 500 })) as typeof fetch;
    expect(await (await call(who, `/${id}/replay`)).json()).toMatchObject({ audioUrl: null, timing: "order" });
  });

  it("streams the audio through, privately cached", async () => {
    const who = await person();
    const id = await sessionWithTurns(who);
    await attach(who, id, "conv_abc123");
    const res = await call(who, `/${id}/replay/audio`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(await res.text()).toBe("ID3audio");
  });

  it("has no audio to serve for a session without a recording", async () => {
    const who = await person();
    const id = await sessionWithTurns(who);
    expect((await call(who, `/${id}/replay/audio`)).status).toBe(404);
  });
});

describe("linking the conversation", () => {
  it("accepts a plain id once, repeats are fine, a different id is refused", async () => {
    const who = await person();
    const id = await sessionWithTurns(who);
    expect((await attach(who, id, "../../voices")).status).toBe(400);
    expect((await attach(who, id, "conv_1")).status).toBe(200);
    expect((await attach(who, id, "conv_1")).status).toBe(200);
    expect((await attach(who, id, "conv_2")).status).toBe(409);
  });
});

describe("ownership", () => {
  it("never lets someone else read, play, link or delete my session", async () => {
    const owner = await person();
    const stranger = await person();
    const id = await sessionWithTurns(owner);
    await attach(owner, id, "conv_abc123");
    fetchMock.mockClear();
    expect((await call(stranger, `/${id}/replay`)).status).toBe(404);
    expect((await call(stranger, `/${id}/replay/audio`)).status).toBe(404);
    expect((await attach(stranger, id, "conv_x")).status).toBe(404);
    expect((await call(stranger, `/${id}`, { method: "DELETE" })).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await findSession(env, owner.id, id)).not.toBeNull();
  });
});

describe("deleting", () => {
  it("deletes the recording at ElevenLabs, then the session and its turns", async () => {
    const who = await person();
    const id = await sessionWithTurns(who);
    await attach(who, id, "conv_abc123");
    expect((await call(who, `/${id}`, { method: "DELETE" })).status).toBe(200);
    expect(elevenLabsCalls()).toEqual(["DELETE https://api.elevenlabs.io/v1/convai/conversations/conv_abc123"]);
    expect(await findSession(env, who.id, id)).toBeNull();
    expect(await listTurns(env, who.id, id)).toEqual([]);
  });

  it("deletes a headset reconnect's extra conversation with the session, and still plays only the first", async () => {
    const who = await person();
    const id = await sessionWithTurns(who);
    await attach(who, id, "conv_first");
    const reconnect = (conversationId: string) => call(who, `/${id}/conversation`, { method: "POST", body: JSON.stringify({ conversationId, reconnect: true }) });
    expect((await reconnect("conv_second")).status).toBe(200);
    expect((await reconnect("conv_second")).status).toBe(200);
    fetchMock.mockClear();
    await call(who, `/${id}/replay/audio`);
    expect(elevenLabsCalls()).toEqual(["GET https://api.elevenlabs.io/v1/convai/conversations/conv_first/audio"]);
    fetchMock.mockClear();
    expect((await call(who, `/${id}`, { method: "DELETE" })).status).toBe(200);
    expect(elevenLabsCalls().sort()).toEqual([
      "DELETE https://api.elevenlabs.io/v1/convai/conversations/conv_first",
      "DELETE https://api.elevenlabs.io/v1/convai/conversations/conv_second",
    ]);
  });

  it("keeps the session when ElevenLabs can't delete the recording, so it can be retried", async () => {
    const who = await person();
    const id = await sessionWithTurns(who);
    await attach(who, id, "conv_abc123");
    deps.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch;
    expect((await call(who, `/${id}`, { method: "DELETE" })).status).toBe(502);
    expect(await findSession(env, who.id, id)).not.toBeNull();
  });

  it("delete-my-data deletes every recording of mine and none of anyone else's", async () => {
    const who = await person();
    const other = await person();
    await attach(who, await sessionWithTurns(who), "conv_mine_1");
    await attach(who, await sessionWithTurns(who), "conv_mine_2");
    await attach(other, await sessionWithTurns(other), "conv_theirs");
    fetchMock.mockClear();
    const res = await call(who, "/me", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(elevenLabsCalls().sort()).toEqual([
      "DELETE https://api.elevenlabs.io/v1/convai/conversations/conv_mine_1",
      "DELETE https://api.elevenlabs.io/v1/convai/conversations/conv_mine_2",
    ]);
  });
});
