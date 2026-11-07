import { Hono } from "hono";
import { startSkill } from "../agents/core/harness";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { onboardingPrefill } from "../agents/skills/onboarding-prefill";
import { extractText, UnreadableDocument } from "../documents/extract";
import { deleteDocument, saveDocument } from "../documents/store";
import type { AppContext, Env } from "../env";
import { isEmptyPatch, parsePatch } from "../memory/profile/patch";
import { updateProfile } from "../memory/profile/store";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;

export function onboardingRouter(makeDeps: MakeDeps) {
  const router = new Hono<AppContext>();

  // reads the file, keeps only its text for an hour, and returns a draft profile; nothing is saved to the profile yet
  router.post("/resume", async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return c.json({ error: "send the resume as a multipart field named file" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "the file is over 5 MB" }, 413);

    const userId = c.var.sessionId;
    let documentId: string;
    try {
      const doc = await extractText(c.env, { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name });
      documentId = await saveDocument(c.env, userId, { name: file.name, ...doc });
    } catch (e) {
      if (e instanceof UnreadableDocument) return c.json({ error: e.message }, 415);
      throw e;
    }

    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    const { result } = await startSkill(makeDeps(c.env, waitUntil), { skill: onboardingPrefill, platform: "app", userId, input: { documentId } });
    const run = await result;
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
