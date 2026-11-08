import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { tailoredRouter } from "../../src/api/resume-tailored";
import type { AppContext } from "../../src/env";
import type { GeminiContent } from "../../src/integrations/gemini";
import { newPostingId, savePosting } from "../../src/postings/store";
import { getResume, putResume } from "../../src/resume/store";
import type { TailoredResume } from "../../src/resume/tailor/types";
import { call, fakeDeps, fakeMemory } from "../agents/fakes";
import { sampleResume } from "../resume/fixtures";

const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;

async function tailorApp(replies: GeminiContent[] = [], options: { hourlyLimit?: number } = {}) {
  const memory = fakeMemory();
  await memory.updateProfile({ skills: [{ name: "Python", source: "resume" }, { name: "Tableau", source: "self-reported" }] });
  const fakes = fakeDeps({ replies, memory });
  const app = new Hono<AppContext>()
    .use(async (c, next) => {
      c.set("sessionId", c.req.header("x-test-user") ?? "u1");
      await next();
    })
    .route("/", tailoredRouter(() => fakes.deps, options));
  const request = (user: string, method: string, path = "/", body?: unknown) =>
    app.request(path, { method, headers: { "x-test-user": user, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }, env, executionCtx);
  return { request, ...fakes };
}

const user = () => `tailor-${crypto.randomUUID()}`;

const posting = {
  title: "Junior Data Analyst", company: "Acme Analytics", companySlug: null, location: null, seniority: null,
  requirements: [
    { text: "Strong SQL skills", topic: "SQL", required: true, have: true },
    { text: "Tableau dashboards", topic: "Tableau", required: true, have: true, evidence: "Skill: Tableau" },
    { text: "Kubernetes", topic: "Kubernetes", required: false, have: false },
  ],
  responsibilities: [], skills: ["SQL", "Tableau"], sourceUrl: null, prefilled: { targetRole: null, company: null, steps: [] },
};

async function seeded() {
  const me = user();
  await putResume(env, me, sampleResume);
  const saved = await savePosting(env, me, newPostingId(), posting);
  return { me, postingId: saved.id };
}

const tailorReply = call("finish", {
  changes: [
    { action: "rewrite", path: "experience[0].bullets[1]", before: "Wrote SQL reports in Postgres for the lending team", after: "Wrote SQL reports in Postgres that the lending team relied on", why: "Leads with SQL.", requirement: 1 },
    { action: "rewrite", path: "experience[0].bullets[0]", before: "Worked on a Python Flask API", after: "Built Tableau dashboards on a Python Flask API", why: "Tableau.", requirement: 2 },
    { action: "remove", path: "experience[0].bullets[0]", before: "Worked on a Python Flask API", why: "Less relevant to a data role." },
  ],
});

describe("/api/resume/tailored", () => {
  it("tailors a copy for a saved posting, keeping only grounded changes and leaving the base alone", async () => {
    const { me, postingId } = await seeded();
    const { request, conversations } = await tailorApp([tailorReply]);
    const res = await request(me, "POST", "/", { postingId });
    expect(res.status).toBe(201);
    const body = await res.json<TailoredResume>();
    expect(body).toMatchObject({ id: expect.stringMatching(/^tr_/), postingId, title: "Junior Data Analyst", company: "Acme Analytics", editedByHand: false });
    expect(body.changes.map((c) => [c.kind, c.basedOn, c.requirement])).toEqual([
      ["reword", "experience[0].bullets[1]", "Strong SQL skills"],
      ["trim", "experience[0].bullets[0]", null],
      ["reorder", "skills", "Strong SQL skills"],
    ]);
    expect(body.resume.experience[0].bullets).toEqual(["Wrote SQL reports in Postgres that the lending team relied on"]);
    expect(body.resume.skills).toEqual(["SQL", "Tableau", "Python", "SwiftUI"]);
    expect(body.match).toMatchObject({ coveredBefore: 1, covered: [{ topic: "SQL" }, { topic: "Tableau" }], missing: [{ topic: "Kubernetes" }] });
    expect(await getResume(env, me)).toMatchObject({ experience: [{ bullets: sampleResume.experience[0].bullets }], skills: sampleResume.skills });
    expect(conversations[0][0].parts[0].text).toContain("<untrusted-web-content>");
  });

  it("imports pasted posting text first, then lists the version with its match count", async () => {
    const me = user();
    await putResume(env, me, sampleResume);
    const imported = call("finish", { title: "Data Analyst", company: "Beta Co", requirements: [{ text: "SQL", topic: "SQL", required: true }], responsibilities: [], skills: ["SQL"] });
    const { request } = await tailorApp([imported, call("finish", { changes: [] })]);
    const res = await request(me, "POST", "/", { text: "Data Analyst at Beta Co. Requirements: SQL." });
    expect(res.status).toBe(201);
    const list = await (await request(me, "GET")).json<{ tailored: unknown[] }>();
    expect(list.tailored).toEqual([{ id: expect.any(String), postingId: expect.stringMatching(/^po_/), title: "Data Analyst", company: "Beta Co", covered: 1, total: 1, updatedAt: expect.any(String) }]);
  });

  it("reverts and re-accepts a change, and freezes toggles after a hand edit", async () => {
    const { me, postingId } = await seeded();
    const { request } = await tailorApp([tailorReply]);
    const made = await (await request(me, "POST", "/", { postingId })).json<TailoredResume>();

    const reverted = await (await request(me, "PUT", `/${made.id}`, { changes: [{ id: "c1", accepted: false }, { id: "c2", accepted: false }] })).json<TailoredResume>();
    expect(reverted.resume.experience[0].bullets).toEqual(sampleResume.experience[0].bullets);
    expect(reverted.changes.map((c) => c.accepted)).toEqual([false, false, true]);

    const edited = { ...reverted.resume, summary: "Edited by hand" };
    const saved = await (await request(me, "PUT", `/${made.id}`, { resume: edited })).json<TailoredResume>();
    expect(saved).toMatchObject({ editedByHand: true, resume: { summary: "Edited by hand" } });
    expect((await request(me, "PUT", `/${made.id}`, { changes: [{ id: "c1", accepted: true }] })).status).toBe(409);
    expect((await request(me, "PUT", `/${made.id}`, { changes: "nope" })).status).toBe(400);
  });

  it("serves the tailored version as a PDF and deletes it", async () => {
    const { me, postingId } = await seeded();
    const { request } = await tailorApp([tailorReply]);
    const made = await (await request(me, "POST", "/", { postingId })).json<TailoredResume>();
    const pdf = await request(me, "GET", `/${made.id}/pdf`);
    expect(pdf.headers.get("Content-Type")).toBe("application/pdf");
    expect(pdf.headers.get("Content-Disposition")).toContain("Resume-Acme-Analytics.pdf");
    expect(new TextDecoder("latin1").decode(await pdf.arrayBuffer())).toContain("relied on");
    expect(await (await request(me, "DELETE", `/${made.id}`)).json()).toEqual({ deleted: true });
    expect((await request(me, "GET", `/${made.id}`)).status).toBe(404);
  });

  it("keeps people apart", async () => {
    const { me, postingId } = await seeded();
    const { request } = await tailorApp([tailorReply]);
    const made = await (await request(me, "POST", "/", { postingId })).json<TailoredResume>();
    const other = user();
    expect((await request(other, "GET", `/${made.id}`)).status).toBe(404);
    expect((await request(other, "GET", `/${made.id}/pdf`)).status).toBe(404);
    expect((await request(other, "PUT", `/${made.id}`, { changes: [] })).status).toBe(404);
    expect((await request(other, "DELETE", `/${made.id}`)).status).toBe(404);
    expect(await (await request(other, "GET")).json()).toEqual({ tailored: [] });
    expect((await request(other, "POST", "/", { postingId })).status).toBe(404);
  });

  it("answers 400 for a bad body, 422 for an empty resume, 429 over the limit and 502 when the model doesn't finish", async () => {
    const { me, postingId } = await seeded();
    expect((await (await tailorApp()).request(me, "POST", "/", {})).status).toBe(400);
    expect((await (await tailorApp()).request(me, "POST", "/", { postingId: "../etc" })).status).toBe(400);
    expect((await (await tailorApp([], { hourlyLimit: 0 })).request(me, "POST", "/", { postingId })).status).toBe(429);
    expect((await (await tailorApp([{ role: "model", parts: [{ text: "no finish" }] }])).request(me, "POST", "/", { postingId })).status).toBe(502);
    const empty = user();
    const { id } = await savePosting(env, empty, newPostingId(), posting);
    expect((await (await tailorApp()).request(empty, "POST", "/", { postingId: id })).status).toBe(422);
  });
});
