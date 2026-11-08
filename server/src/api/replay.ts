import { Hono } from "hono";
import type { AppContext } from "../env";
import { buildReplay } from "../replay/build";
import { fetchAudio, isConversationId } from "../replay/elevenlabs";
import { forgetRecordings } from "../replay/forget";
import { attachConversation, attachReconnect, conversationOf, deleteSession, recordingsOf } from "../replay/store";
import { findSession } from "../voice/store";

// the recording and its notes are personal; shared caches must never keep them
const PRIVATE = "private, max-age=3600";

/** Mounted at /api/voice/sessions. Every route first proves the session is the caller's. */
export function replayRouter() {
  const router = new Hono<AppContext>();

  // the client learns the conversation id from the ElevenLabs SDK as soon as the call connects
  router.post("/:id/conversation", async (c) => {
    const session = await findSession(c.env, c.var.sessionId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    const body = await c.req.json<{ conversationId?: unknown; reconnect?: unknown }>().catch(() => null);
    if (!isConversationId(body?.conversationId)) return c.json({ error: "send the conversation id" }, 400);
    // a reconnect's new conversation is kept only so it is deleted with the session; the replay stays on the first
    const attach = body.reconnect === true ? attachReconnect : attachConversation;
    if (!(await attach(c.env, c.var.sessionId, session.id, body.conversationId))) {
      return c.json({ error: "this session already has a recording" }, 409);
    }
    return c.json({ ok: true });
  });

  router.get("/:id/replay", async (c) => {
    const session = await findSession(c.env, c.var.sessionId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    const replay = await buildReplay(c.env, c.var.sessionId, session.id);
    c.header("Cache-Control", replay.recording === "processing" ? "private, no-store" : PRIVATE);
    return c.json(replay);
  });

  // a proxy, so the ElevenLabs key never leaves the server and only the owner can listen
  router.get("/:id/replay/audio", async (c) => {
    const session = await findSession(c.env, c.var.sessionId, c.req.param("id"));
    const conversationId = session && (await conversationOf(c.env, c.var.sessionId, session.id));
    if (!conversationId) return c.json({ error: "no recording for this session" }, 404);
    const upstream = await fetchAudio(c.env, conversationId).catch(() => null);
    if (!upstream?.ok || !upstream.body) return c.json({ error: "the recording isn't available" }, 404);
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "audio/mpeg",
        ...(upstream.headers.get("Content-Length") ? { "Content-Length": upstream.headers.get("Content-Length")! } : {}),
        "Cache-Control": PRIVATE,
      },
    });
  });

  // the recording goes first: if ElevenLabs can't delete it, the session stays so the person can try again
  router.delete("/:id", async (c) => {
    const session = await findSession(c.env, c.var.sessionId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    const recordings = await recordingsOf(c.env, c.var.sessionId, session.id);
    if ((await forgetRecordings(c.env, recordings)) > 0) {
      return c.json({ error: "couldn't delete the recording just now, try again" }, 502);
    }
    await deleteSession(c.env, c.var.sessionId, session.id);
    return c.json({ deleted: true });
  });

  return router;
}

export const replay = replayRouter();
