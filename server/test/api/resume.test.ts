import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AgentDeps } from "../../src/agents/core/types";
import { resumeRouter } from "../../src/api/resume";
import type { AppContext } from "../../src/env";
import { updateProfile } from "../../src/memory/profile/store";
import { call, fakeDeps } from "../agents/fakes";
import { samples } from "../documents/samples";
import { sampleResume } from "../resume/fixtures";

function testApp(deps: AgentDeps = fakeDeps().deps) {
  const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
  const app = new Hono<AppContext>()
    .use(async (c, next) => {
      c.set("sessionId", c.req.header("x-test-user") ?? "u1");
      await next();
    })
    .route("/", resumeRouter(() => deps));
  return (user: string, method: string, path = "/", body?: unknown) =>
    app.request(
      path,
      { method, headers: { "x-test-user": user, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) },
      env,
      executionCtx,
    );
}

const user = () => `resume-${crypto.randomUUID()}`;

function upload(deps: AgentDeps, me: string, file: File) {
  const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
  const app = new Hono<AppContext>()
    .use(async (c, next) => {
      c.set("sessionId", me);
      await next();
    })
    .route("/", resumeRouter(() => deps));
  const form = new FormData();
  form.set("file", file);
  return app.request("/upload", { method: "POST", body: form }, env, executionCtx);
}

describe("/api/resume", () => {
  it("seeds an unsaved resume from the profile", async () => {
    const me = user();
    await updateProfile(env, me, { headline: "Third-year student", skills: [{ name: "Python", source: "resume" }] });
    const res = await testApp()(me, "GET");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ saved: false, resume: { summary: "Third-year student", skills: ["Python"] } });
  });

  it("saves a resume, reads it back and keeps people apart", async () => {
    const request = testApp();
    const me = user();
    const put = await request(me, "PUT", "/", sampleResume);
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ saved: true, resume: { ...sampleResume, updatedAt: expect.any(String) } });
    expect(await (await request(me, "GET")).json()).toMatchObject({ saved: true, resume: { contact: { name: "Jordan Lee" } } });
    expect(await (await request(user(), "GET")).json()).toMatchObject({ saved: false, resume: { contact: { name: "" } } });
  });

  it("rejects a body that is not a resume", async () => {
    expect((await testApp()(user(), "PUT", "/", ["nope"])).status).toBe(400);
  });

  it("runs the coach on the saved resume and answers with verified suggestions", async () => {
    const me = user();
    await updateProfile(env, me, { targetRoles: ["Junior data analyst"] });
    const { deps, conversations } = fakeDeps({
      replies: [call("finish", { suggestions: [{ path: "experience[0].bullets[0]", before: "Worked on a Python Flask API", after: "Built a Python Flask API", why: "Verb." }] })],
    });
    const request = testApp(deps);
    await request(me, "PUT", "/", sampleResume);
    const res = await request(me, "POST", "/improve", { section: "experience" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ runId: expect.any(String), suggestions: [{ path: "experience[0].bullets[0]", after: "Built a Python Flask API" }] });
    const goal = conversations[0][0].parts[0].text ?? "";
    expect(goal).toContain("Target role: Junior data analyst.");
    expect(goal).not.toContain("summary:");
  });

  it("answers 502 when the coach does not finish", async () => {
    const request = testApp(fakeDeps({ replies: [{ role: "model", parts: [{ text: "no finish" }] }] }).deps);
    const res = await request(user(), "POST", "/improve", {});
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ runId: expect.any(String), error: expect.any(String) });
  });

  it("serves the resume as a PDF attachment", async () => {
    const request = testApp();
    const me = user();
    await request(me, "PUT", "/", sampleResume);
    const res = await request(me, "GET", "/pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("Resume.pdf");
    const text = new TextDecoder("latin1").decode(await res.arrayBuffer());
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("(Jordan Lee) Tj");
  });

  it("lays an uploaded resume out for the builder without saving it", async () => {
    const me = user();
    const { deps } = fakeDeps({
      replies: [
        call("finish", {
          headline: "Computer science student",
          experience: [{ role: "Intern", org: "Acme", highlights: ["Built a Python Flask API for 2,000 users"] }],
          skills: [
            { name: "Python", source: "resume", evidence: "Built a Python Flask API" },
            { name: "Rust", source: "resume", evidence: "Wrote a Rust compiler" },
          ],
        }),
      ],
    });
    const res = await upload(deps, me, new File([samples.text], "resume.txt"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      saved: false,
      droppedClaims: 1,
      resume: {
        summary: "Computer science student",
        experience: [{ role: "Intern", org: "Acme", bullets: ["Built a Python Flask API for 2,000 users"] }],
        skills: ["Python"],
      },
    });
    expect(await (await testApp()(me, "GET")).json()).toMatchObject({ saved: false, resume: { experience: [] } });
  });

  it("refuses uploads it cannot read", async () => {
    const { deps } = fakeDeps();
    expect((await upload(deps, user(), new File([samples.legacyDoc], "old.doc"))).status).toBe(415);
    expect((await upload(deps, user(), new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.txt"))).status).toBe(413);
  });
});
