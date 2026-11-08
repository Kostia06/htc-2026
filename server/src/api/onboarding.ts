import { rememberContact } from "../resume/store";
import { Hono } from "hono";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { orchestrate } from "../agents/orchestrator";
import { extractText, MAX_UPLOAD_BYTES, UnreadableDocument } from "../documents/extract";
import { deleteDocument, saveDocument } from "../documents/store";
import type { AppContext, Env } from "../env";
import { isEmptyPatch, parsePatch } from "../memory/profile/patch";
import { updateProfile } from "../memory/profile/store";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;

export function onboardingRouter(makeDeps: MakeDeps) {
  const router = new Hono<AppContext>();

  // reads the file, keeps only its text for an hour, and returns a draft profile; nothing is saved to the profile yet.
  // The text goes straight to the agent so the draft takes one model call instead of a tool round trip.
  router.post("/resume", async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return c.json({ error: "send the resume as a multipart field named file" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "the file is over 5 MB" }, 413);

    const userId = c.var.sessionId;
    let documentId: string;
    let text: string;
    try {
      const doc = await extractText(c.env, { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name });
      documentId = await saveDocument(c.env, userId, { name: file.name, ...doc });
      text = doc.text;
    } catch (e) {
      if (e instanceof UnreadableDocument) return c.json({ error: e.message }, 415);
      throw e;
    }

    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    // name, email and phone from the resume go straight onto their Skillit resume, read by code, never by the model
    await rememberContact(c.env, userId, text).catch((e) => console.warn("[onboarding] contact not kept:", (e as Error).message));
    const run = await orchestrate(makeDeps(c.env, waitUntil), { skillId: "onboarding-prefill", platform: "app", userId, input: { text } });
    if (run.status === "failed") return c.json({ documentId, error: "the resume was read but the draft could not be made, fill it in by hand" }, 502);
    return c.json({ documentId, ...run.output });
  });

  // the person checked and edited the draft: save it and forget the uploaded text
  router.post("/confirm", async (c) => {
    const body = await c.req.json<{ documentId?: unknown; profile?: unknown }>().catch(() => null);
    const patch = parsePatch(body?.profile);
    if (!patch || isEmptyPatch(patch)) return c.json({ error: "send the confirmed profile fields" }, 400);
    const profile = await updateProfile(c.env, c.var.sessionId, patch);
    if (typeof body?.documentId === "string") await deleteDocument(c.env, c.var.sessionId, body.documentId);
    return c.json({ profile });
  });

  router.delete("/resume/:id", async (c) => {
    await deleteDocument(c.env, c.var.sessionId, c.req.param("id"));
    return c.body(null, 204);
  });

  return router;
}

export const onboarding = onboardingRouter(liveDeps);
