import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { Model } from "../../src/agents/core/loop";
import { onboardingRouter } from "../../src/api/onboarding";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import { readDocument, saveDocument } from "../../src/documents/store";
import type { AppContext } from "../../src/env";
import { getProfile } from "../../src/memory/profile/store";
import { call, fakeDeps } from "../agents/fakes";
import { samples } from "../documents/samples";

// reads the document id out of the goal, then drafts from whatever read_document returned
const draftingModel: Model = async (contents) => {
  const goal = contents[0].parts[0].text ?? "";
  if (contents.length === 1) return call("read_document", { document_id: goal.match(/document (\S+?)\.?$/)?.[1] ?? "" });
  return call("finish", {
    summary: "Computer science student",
    skills: [
      { name: "Python", source: "resume", evidence: "Built a Python Flask API" },
      { name: "Rust", source: "resume", evidence: "Wrote a Rust compiler" },
    ],
    missing: ["Which role do you want next?"],
  });
};

function onboardingApp(model: Model = draftingModel) {
  const app = new Hono<AppContext>();
  app.use("*", requireSession);
  app.route("/", onboardingRouter(() => ({ ...fakeDeps().deps, memoryFor: (id) => fakeDeps().deps.memoryFor(id), model: () => model })));
  return app;
}

async function person() {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, id: (await verifySession(token, env.SESSION_SECRET))! };
}

function upload(app: Hono<AppContext>, token: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  return app.request("/resume", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }, env);
}

describe("/api/onboarding", () => {
  it("turns an uploaded Word resume into a checked draft without saving it", async () => {
    const me = await person();
    const res = await upload(onboardingApp(), me.token, new File([samples.docx], "resume.docx"));
    expect(res.status).toBe(200);
    const body = await res.json<{ documentId: string; draft: { skills: { name: string }[] }; missing: string[]; droppedClaims: number }>();
    expect(body.draft.skills.map((s) => s.name)).toEqual(["Python"]);
    expect(body).toMatchObject({ missing: ["Which role do you want next?"], droppedClaims: 1 });
    expect((await getProfile(env, me.id)).skills).toEqual([]);
  });

  it("refuses files it cannot read and oversized uploads", async () => {
    const me = await person();
    expect((await upload(onboardingApp(), me.token, new File([samples.legacyDoc], "old.doc"))).status).toBe(415);
    expect((await upload(onboardingApp(), me.token, new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.txt"))).status).toBe(413);
  });

  it("saves the confirmed profile and forgets the uploaded text", async () => {
    const me = await person();
    const documentId = await saveDocument(env, me.id, { name: "r.txt", format: "text", text: "Built a Flask API" });
    const res = await onboardingApp().request(
      "/confirm",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${me.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, profile: { targetRoles: ["Junior developer"] } }),
      },
      env,
    );
    expect(res.status).toBe(200);
    expect((await getProfile(env, me.id)).targetRoles).toEqual(["Junior developer"]);
    expect(await readDocument(env, me.id, documentId)).toBeNull();
  });
});
