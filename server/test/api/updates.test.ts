import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { updatesRouter } from "../../src/api/updates";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";
import type { GeminiContent } from "../../src/integrations/gemini";
import { insertSteps, loadAll } from "../../src/roadmap/store";
import type { StepContent } from "../../src/roadmap/types";
import { call, fakeDeps, fakeMemory, type FakeMemory } from "../agents/fakes";

type Reply = { reply: string; needsAnswer: boolean; applied: { type: string; summary: string }[]; error?: string };
type Options = { timeoutMs?: number; hourlyLimit?: number; model?: ReturnType<typeof fakeDeps>["deps"]["model"] };

function updatesApp(replies: GeminiContent[], memory: FakeMemory = fakeMemory(), options: Options = {}) {
  const app = new Hono<AppContext>();
  app.use("*", requireSession);
  const fakes = fakeDeps({ replies, memory, ...(options.model ? { model: options.model } : {}) });
  app.route("/", updatesRouter(() => fakes.deps, options));
  return { app, ...fakes };
}

async function person() {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, id: (await verifySession(token, env.SESSION_SECRET))! };
}

const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
const send = (app: Hono<AppContext>, token: string, body: unknown) =>
  app.request("/", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }, env, executionCtx);

const step = (kind: StepContent["kind"], title: string): StepContent => ({ kind, title, why: "w", detail: "d", estimate: "1 h", label: "ready_now" });

async function seedSteps(userId: string, contents: StepContent[]) {
  await insertSteps(env, userId, 0, contents, "template");
  return loadAll(env, userId);
}

const finish = (reply: string, actions: unknown[], needsAnswer = false) => call("finish", { reply, needsAnswer, actions });

describe("POST /api/updates", () => {
  it("completes the matching step and keeps the person's words as its note", async () => {
    const me = await person();
    const [flask] = await seedSteps(me.id, [step("project", "Build a Flask dashboard"), step("course", "Finish the SQL course")]);
    const { app, conversations } = updatesApp([finish("Nice, the Flask dashboard is done.", [{ type: "complete_step", stepId: "s1" }])]);

    const res = await send(app, me.token, { message: "I finished the Flask dashboard project" });
    expect(res.status).toBe(200);
    expect(await res.json<Reply>()).toEqual({
      reply: "Nice, the Flask dashboard is done.",
      needsAnswer: false,
      applied: [{ type: "complete_step", summary: 'Marked "Build a Flask dashboard" done' }],
    });
    const saved = (await loadAll(env, me.id)).find((s) => s.id === flask.id)!;
    expect(saved).toMatchObject({ status: "done", note: "I finished the Flask dashboard project" });
    const goal = conversations[0][0].parts[0].text!;
    expect(goal).toContain("s1 [project] Build a Flask dashboard");
    expect(goal).not.toContain(flask.id);
    expect(goal).toContain("You may ask one clarifying question");
  });

  it("asks one question when the update is ambiguous, then applies with no question left", async () => {
    const me = await person();
    await seedSteps(me.id, [step("project", "Build a Flask dashboard"), step("project", "Ship the portfolio site")]);
    const { app, conversations } = updatesApp([
      finish("Which one: the Flask dashboard or the portfolio site?", [{ type: "complete_step", stepId: "s1" }], true),
      finish("Portfolio site, done.", [{ type: "complete_step", stepId: "s2" }]),
    ]);

    const first = await (await send(app, me.token, { message: "finished my project" })).json<Reply>();
    expect(first).toEqual({ reply: "Which one: the Flask dashboard or the portfolio site?", needsAnswer: true, applied: [] });
    expect((await loadAll(env, me.id)).every((s) => s.status === "todo")).toBe(true);

    const conversation = [{ speaker: "user", text: "finished my project" }, { speaker: "raven", text: first.reply }];
    const second = await (await send(app, me.token, { message: "the portfolio one", conversation })).json<Reply>();
    expect(second).toMatchObject({ needsAnswer: false, applied: [{ type: "complete_step", summary: 'Marked "Ship the portfolio site" done' }] });
    expect(conversations[1][0].parts[0].text).toContain("no questions left");
  });

  it("never asks a second time, even if the model wants to", async () => {
    const me = await person();
    const { app } = updatesApp([finish("And which company?", [], true)]);
    const conversation = [{ speaker: "user", text: "got an interview" }, { speaker: "raven", text: "Where?" }];
    const body = await (await send(app, me.token, { message: "next week", conversation })).json<Reply>();
    expect(body.needsAnswer).toBe(false);
  });

  it("refuses a step that isn't theirs, by key or by real id, and says so instead of the model's line", async () => {
    const other = await person();
    const [theirs] = await seedSteps(other.id, [step("project", "Their project")]);
    const me = await person();
    const { app } = updatesApp([finish("Done!", [{ type: "complete_step", stepId: theirs.id }, { type: "complete_step", stepId: "s1" }])]);

    const body = await (await send(app, me.token, { message: "finished it" })).json<Reply>();
    expect(body.applied).toEqual([]);
    expect(body.reply).toContain("couldn't match");
    expect((await loadAll(env, other.id))[0].status).toBe("todo");
  });

  it("edits the profile: skills, projects, roles, experience", async () => {
    const me = await person();
    const memory = fakeMemory();
    await memory.updateProfile({ skills: [{ name: "Excel", source: "self-reported" }] });
    const { app } = updatesApp(
      [
        finish("Added Figma, dropped Excel, and your new project.", [
          { type: "add_skill", name: "Figma" },
          { type: "remove_skill", name: "excel" },
          { type: "add_project", name: "Flask dashboard", summary: "Sales dashboard in Flask" },
          { type: "add_target_role", name: "Product designer" },
          { type: "add_experience", role: "Barista", org: "Analog Coffee", when: "2024" },
        ]),
      ],
      memory,
    );

    const body = await (await send(app, me.token, { message: "add Figma to my skills, remove Excel, I built a Flask dashboard, aiming for product designer, and I was a barista at Analog in 2024" })).json<Reply>();
    expect(body.applied.map((a) => a.summary)).toEqual([
      "Added skill Figma",
      "Removed skill excel",
      'Added project "Flask dashboard"',
      "Added target role Product designer",
      "Added Barista at Analog Coffee",
    ]);
    const profile = await memory.profile();
    expect(profile.skills).toEqual([{ name: "Figma", source: "self-reported" }]);
    expect(profile.projects).toEqual([{ name: "Flask dashboard", summary: "Sales dashboard in Flask" }]);
    expect(profile.targetRoles).toEqual(["Product designer"]);
    expect(profile.experience).toEqual([{ role: "Barista", org: "Analog Coffee", start: "2024" }]);
  });

  it("logs an event against a matching networking step, or as a private note when there is none", async () => {
    const me = await person();
    const memory = fakeMemory();
    const [meetup] = await seedSteps(me.id, [step("event", "Go to the Calgary JS meetup"), step("project", "Build a thing")]);
    const { app } = updatesApp(
      [
        finish("Logged the meetup.", [{ type: "attended_event", name: "Calgary JS meetup", stepId: "s1" }]),
        finish("Noted.", [{ type: "attended_event", name: "Platform Calgary demo night" }]),
        finish("Good luck!", [{ type: "upcoming_interview", org: "ATB", when: "next Tuesday" }]),
      ],
      memory,
    );

    const first = await (await send(app, me.token, { message: "went to the Calgary JS meetup last night, met a dev from Neo" })).json<Reply>();
    expect(first.applied).toEqual([{ type: "attended_event", summary: 'Marked "Go to the Calgary JS meetup" done' }]);
    expect((await loadAll(env, me.id)).find((s) => s.id === meetup.id)).toMatchObject({ status: "done", note: "went to the Calgary JS meetup last night, met a dev from Neo" });

    const second = await (await send(app, me.token, { message: "went to Platform Calgary demo night, email me at a@b.co" })).json<Reply>();
    expect(second.applied).toEqual([{ type: "attended_event", summary: "Noted you went to Platform Calgary demo night" }]);
    expect(memory.items.at(-1)).toMatchObject({ kind: "note", text: "Went to Platform Calgary demo night. went to Platform Calgary demo night, email me at [email]" });

    const third = await (await send(app, me.token, { message: "I got an interview at ATB next Tuesday" })).json<Reply>();
    expect(third.applied).toEqual([{ type: "upcoming_interview", summary: "Noted your interview at ATB next Tuesday" }]);
    expect(memory.items.at(-1)).toMatchObject({ kind: "note", text: "Interview at ATB (next Tuesday). I got an interview at ATB next Tuesday" });
  });

  it("applies nothing for something that isn't an update, and caps the reply at 25 words", async () => {
    const me = await person();
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const { app } = updatesApp([finish(long, [])]);
    const body = await (await send(app, me.token, { message: "what's the weather" })).json<Reply>();
    expect(body.applied).toEqual([]);
    expect(body.needsAnswer).toBe(false);
    expect(body.reply.split(" ")).toHaveLength(25);
  });

  it("rejects a missing message or a malformed conversation", async () => {
    const me = await person();
    const { app } = updatesApp([]);
    expect((await send(app, me.token, {})).status).toBe(400);
    expect((await send(app, me.token, { message: "   " })).status).toBe(400);
    expect((await send(app, me.token, { message: "hi", conversation: [{ speaker: "ghost", text: "boo" }] })).status).toBe(400);
    expect((await send(app, me.token, { message: "hi", conversation: "nope" })).status).toBe(400);
  });

  it("answers 502 when the model never finishes, and 504 when it is too slow", async () => {
    const me = await person();
    const { app } = updatesApp([{ role: "model", parts: [{ text: "hmm" }] }]);
    expect((await send(app, me.token, { message: "done with it" })).status).toBe(502);

    const slow = updatesApp([], fakeMemory(), { timeoutMs: 20, model: () => () => new Promise(() => {}) });
    expect((await send(slow.app, me.token, { message: "done with it" })).status).toBe(504);
  });

  it("rate limits by recorded runs", async () => {
    const me = await person();
    const { app } = updatesApp([finish("ok", []), finish("ok", []), finish("ok", [])], fakeMemory(), { hourlyLimit: 2 });
    expect((await send(app, me.token, { message: "one" })).status).toBe(200);
    expect((await send(app, me.token, { message: "two" })).status).toBe(200);
    expect((await send(app, me.token, { message: "three" })).status).toBe(429);
  });
});
