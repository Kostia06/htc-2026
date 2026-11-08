import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { updatesRouter } from "../../src/api/updates";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import { db } from "../../src/db";
import type { AppContext } from "../../src/env";
import type { GeminiContent } from "../../src/integrations/gemini";
import { insertSteps, loadAll } from "../../src/roadmap/store";
import type { StepContent } from "../../src/roadmap/types";
import { call, fakeDeps, fakeMemory, type FakeMemory } from "../agents/fakes";
import { samples } from "../documents/samples";

type Reply = { reply: string; applied: { type: string; summary: string }[]; error?: string };

const TRANSCRIPT = [
  "University of Calgary - Official Transcript",
  "Bachelor of Science, Computer Science",
  "Fall 2024",
  "CPSC 231 Introduction to Computer Science I   A",
  "CPSC 331 Data Structures and Algorithms   A-",
  "DATA 201 Intro to SQL Databases   B+",
].join("\n");

function fileApp(replies: GeminiContent[], memory: FakeMemory = fakeMemory(), options: { hourlyFileLimit?: number } = {}) {
  const app = new Hono<AppContext>();
  app.use("*", requireSession);
  const fakes = fakeDeps({ replies, memory });
  app.route("/", updatesRouter(() => fakes.deps, options));
  return { app, ...fakes };
}

async function person() {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, id: (await verifySession(token, env.SESSION_SECRET))! };
}

const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
function upload(app: Hono<AppContext>, token: string, file: File | string) {
  const form = new FormData();
  form.set("file", file);
  return app.request("/file", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }, env, executionCtx);
}
const textFile = (text: string, name = "transcript.txt") => new File([new TextEncoder().encode(text)], name);

const step = (kind: StepContent["kind"], title: string): StepContent => ({ kind, title, why: "w", detail: "d", estimate: "1 h", label: "ready_now" });
const finish = (reply: string, actions: unknown[]) => call("finish", { reply, actions });

describe("POST /api/updates/file", () => {
  it("turns a transcript into education, courses taken and a finished course step", async () => {
    const me = await person();
    await insertSteps(env, me.id, 0, [step("course", "Take an intro SQL course"), step("project", "Build a portfolio")], "template");
    const memory = fakeMemory();
    const { app, conversations } = fileApp(
      [
        finish("Added your Computer Science degree and three courses.", [
          { type: "add_education", school: "University of Calgary", program: "Bachelor of Science, Computer Science" },
          { type: "add_course", name: "CPSC 231 Introduction to Computer Science I" },
          { type: "add_course", name: "CPSC 331 Data Structures and Algorithms" },
          { type: "add_course", name: "DATA 201 Intro to SQL Databases" },
          { type: "complete_step", stepId: "s1", name: "DATA 201 Intro to SQL Databases" },
        ]),
      ],
      memory,
    );

    const res = await upload(app, me.token, textFile(TRANSCRIPT));
    expect(res.status).toBe(200);
    const body = await res.json<Reply>();
    expect(body.reply).toBe("Added your Computer Science degree and three courses.");
    expect(body.applied).toEqual([
      { type: "add_education", summary: "Added Bachelor of Science, Computer Science at University of Calgary" },
      { type: "complete_step", summary: 'Marked "Take an intro SQL course" done' },
      { type: "add_course", summary: "Noted 3 courses you've taken" },
    ]);
    expect((await memory.profile()).education).toEqual([{ school: "University of Calgary", program: "Bachelor of Science, Computer Science" }]);
    expect(memory.items.at(-1)?.text).toContain("CPSC 331 Data Structures and Algorithms");
    const steps = await loadAll(env, me.id);
    expect(steps.find((s) => s.kind === "course")?.status).toBe("done");
    expect(steps.find((s) => s.kind === "project")?.status).toBe("todo");

    // the document reaches the model fenced off as untrusted data, never as the conversation itself
    const goal = conversations[0][0].parts[0].text!;
    expect(goal).toContain("<user-document>");
    expect(goal).toContain("CPSC 331 Data Structures and Algorithms");
    expect(goal).toContain("s1 [course] Take an intro SQL course");
  });

  it("drops anything the document doesn't say, and says what really happened", async () => {
    const me = await person();
    const memory = fakeMemory();
    const { app } = fileApp(
      [
        finish("Added your degree, AWS certification and Rust.", [
          { type: "add_education", school: "University of Calgary", program: "Bachelor of Science, Computer Science" },
          { type: "add_certification", name: "AWS Solutions Architect" },
          { type: "add_skill", name: "Rust" },
        ]),
      ],
      memory,
    );

    const body = await (await upload(app, me.token, textFile(TRANSCRIPT))).json<Reply>();
    expect(body.applied.map((a) => a.type)).toEqual(["add_education"]);
    expect(body.reply).not.toContain("AWS");
    const profile = await memory.profile();
    expect(profile.certifications).toEqual([]);
    expect(profile.skills).toEqual([]);
  });

  it("adds a certificate and fills a resume in without duplicating what is already there", async () => {
    const me = await person();
    const memory = fakeMemory();
    await memory.updateProfile({ skills: [{ name: "Python", source: "resume", evidence: "Python" }], experience: [{ role: "Data intern", org: "ATB Financial", start: "2023" }] });
    const resume = "Data intern, ATB Financial, May 2023 - Aug 2023\nSkills: Python, Tableau\nGoogle Data Analytics Certificate";
    const { app } = fileApp(
      [
        finish("Updated your profile from your resume.", [
          { type: "add_experience", role: "Data intern", org: "ATB Financial", when: "May 2023" },
          { type: "add_skill", name: "python" },
          { type: "add_skill", name: "Tableau" },
          { type: "add_certification", name: "Google Data Analytics Certificate" },
        ]),
      ],
      memory,
    );

    const body = await (await upload(app, me.token, textFile(resume, "resume.txt"))).json<Reply>();
    expect(body.applied).toEqual([
      { type: "add_skill", summary: "Added skill Tableau" },
      { type: "add_certification", summary: "Added certification Google Data Analytics Certificate" },
    ]);
    const profile = await memory.profile();
    expect(profile.experience).toHaveLength(1);
    expect(profile.skills.map((s) => s.name)).toEqual(["Python", "Tableau"]);
    expect(profile.certifications).toEqual(["Google Data Analytics Certificate"]);
  });

  it("says so when the file holds nothing new", async () => {
    const me = await person();
    const { app } = fileApp([finish("All set!", [])]);
    const body = await (await upload(app, me.token, textFile("Grocery list: eggs, milk", "list.txt"))).json<Reply>();
    expect(body.applied).toEqual([]);
    expect(body.reply).toContain("nothing new");
  });

  it("refuses missing, unreadable and oversized files", async () => {
    const me = await person();
    const { app } = fileApp([]);
    expect((await upload(app, me.token, "not a file")).status).toBe(400);
    expect((await upload(app, me.token, new File([samples.legacyDoc], "old.doc"))).status).toBe(415);
    expect((await upload(app, me.token, new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.txt"))).status).toBe(413);
  });

  it("never stores the file or its text", async () => {
    const me = await person();
    const { app } = fileApp([finish("ok", [])]);
    await upload(app, me.token, textFile(TRANSCRIPT));
    const row = await db(env).prepare("SELECT count(*) AS n FROM user_documents WHERE user_id = ?").bind(me.id).first<{ n: number }>();
    expect(row?.n ?? 0).toBe(0);
  });

  it("answers 502 when the model never finishes", async () => {
    const me = await person();
    const { app } = fileApp([{ role: "model", parts: [{ text: "hmm" }] }]);
    expect((await upload(app, me.token, textFile(TRANSCRIPT))).status).toBe(502);
  });

  it("rate limits by recorded runs", async () => {
    const me = await person();
    const { app } = fileApp([finish("ok", []), finish("ok", []), finish("ok", [])], fakeMemory(), { hourlyFileLimit: 2 });
    expect((await upload(app, me.token, textFile(TRANSCRIPT))).status).toBe(200);
    expect((await upload(app, me.token, textFile(TRANSCRIPT))).status).toBe(200);
    expect((await upload(app, me.token, textFile(TRANSCRIPT))).status).toBe(429);
  });
});
