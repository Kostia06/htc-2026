import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentDeps } from "../../src/agents/core/types";
import { resumeRouter } from "../../src/api/resume";
import { deps as extract } from "../../src/documents/extract";
import type { AppContext } from "../../src/env";
import { updateProfile } from "../../src/memory/profile/store";
import { call, fakeDeps } from "../agents/fakes";
import { samples } from "../documents/samples";
import { linkedinPdfText } from "../resume/fixtures";

afterEach(() => vi.restoreAllMocks());

function review(deps: AgentDeps, me: string, file: File) {
  const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
  const app = new Hono<AppContext>()
    .use(async (c, next) => {
      c.set("sessionId", me);
      await next();
    })
    .route("/", resumeRouter(() => deps));
  const form = new FormData();
  form.set("file", file);
  return app.request("/linkedin", { method: "POST", body: form }, env, executionCtx);
}

const user = () => `li-${crypto.randomUUID()}`;
const pdf = () => new File([samples.pdf], "Profile.pdf", { type: "application/pdf" });

describe("POST /api/resume/linkedin", () => {
  it("reviews the PDF against the target role with grounded suggestions, and keeps nothing", async () => {
    vi.spyOn(extract, "transcribe").mockResolvedValue(linkedinPdfText);
    const me = user();
    await updateProfile(env, me, { targetRoles: ["Data analyst"] });
    const { deps, conversations } = fakeDeps({
      replies: [
        call("finish", {
          suggestions: [
            { area: "headline", quote: "Student at University of Calgary", suggestion: "CS student at the University of Calgary aiming for data analyst roles", why: "Names the role." },
            { area: "skills", quote: "Made-up quote", suggestion: "x", why: "y" },
          ],
        }),
      ],
    });
    const res = await review(deps, me, pdf());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      targetRole: "Data analyst",
      suggestions: [{ area: "headline", quote: "Student at University of Calgary", suggestion: "CS student at the University of Calgary aiming for data analyst roles", why: "Names the role." }],
      droppedClaims: 1,
    });
    const seen = JSON.stringify(conversations);
    for (const leak of ["jordan.lee@example.com", "555-0199", "linkedin.com/in", "https://"]) expect(seen).not.toContain(leak);
    const stored = await env.DB.prepare("SELECT COUNT(*) AS n FROM user_documents WHERE user_id = ?").bind(me).first<{ n: number }>();
    expect(stored?.n).toBe(0);
  });

  it("asks for LinkedIn's PDF and reads nothing else", async () => {
    const spy = vi.spyOn(extract, "transcribe");
    const res = await review(fakeDeps().deps, user(), new File([samples.text], "profile.txt"));
    expect(res.status).toBe(415);
    expect(spy).not.toHaveBeenCalled();
  });

  it("says so when the review can't be made", async () => {
    vi.spyOn(extract, "transcribe").mockResolvedValue(linkedinPdfText);
    const res = await review(fakeDeps({ replies: [{ role: "model", parts: [{ text: "no finish" }] }] }).deps, user(), pdf());
    expect(res.status).toBe(502);
  });
});
