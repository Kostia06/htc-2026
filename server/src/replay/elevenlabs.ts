import type { Env } from "../env";
import type { TimedLine } from "./align";

const API = "https://api.elevenlabs.io/v1/convai/conversations";

export const deps = { fetch: (input: RequestInfo, init?: RequestInit) => fetch(input, init) };

export type RecordingStatus = "ready" | "processing" | "none";
export type Conversation = { status: RecordingStatus; durationSec: number; lines: TimedLine[] };

type Details = {
  agent_id?: string;
  status?: string;
  has_audio?: boolean;
  metadata?: { call_duration_secs?: number };
  transcript?: { role?: string; message?: string | null; time_in_call_secs?: number }[];
};

// ids come from the client, so only plain ElevenLabs-style ids ever reach a URL path
export const isConversationId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{4,100}$/.test(value);

const url = (id: string, suffix = "") => `${API}/${encodeURIComponent(id)}${suffix}`;
// the voice decorates lines with tags like [laughs]; people read the words
const spoken = (text: string) => text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();

function keyOf(env: Env) {
  if (!env.ELEVENLABS_API_KEY) throw new Error("elevenlabs is not configured");
  return env.ELEVENLABS_API_KEY;
}

function statusOf(details: Details): RecordingStatus {
  if (details.status === "failed") return "none";
  if (details.status !== "done") return "processing";
  return details.has_audio ? "ready" : "none";
}

export function readDetails(details: Details): Conversation {
  const lines = (details.transcript ?? []).flatMap((line): TimedLine[] => {
    const text = spoken(line.message ?? "");
    if (!text || (line.role !== "user" && line.role !== "agent")) return [];
    return [{ t: Math.max(0, line.time_in_call_secs ?? 0), speaker: line.role === "user" ? "person" : "agent", text }];
  });
  const lastLine = lines.at(-1)?.t ?? 0;
  return { status: statusOf(details), durationSec: Math.max(details.metadata?.call_duration_secs ?? 0, lastLine), lines };
}

/** Null when ElevenLabs has no such conversation, or it belongs to another agent than ours. */
export async function fetchConversation(env: Env, id: string): Promise<Conversation | null> {
  const res = await deps.fetch(url(id), { headers: { "xi-api-key": keyOf(env) } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`elevenlabs conversation ${res.status}`);
  const details = await res.json<Details>();
  if (env.ELEVENLABS_AGENT_ID && details.agent_id && details.agent_id !== env.ELEVENLABS_AGENT_ID) return null;
  return readDetails(details);
}

export async function fetchAudio(env: Env, id: string): Promise<Response> {
  return deps.fetch(url(id, "/audio"), { headers: { "xi-api-key": keyOf(env) } });
}

/** True once ElevenLabs no longer has it, including when it was already gone. */
export async function deleteConversation(env: Env, id: string): Promise<boolean> {
  const res = await deps.fetch(url(id), { method: "DELETE", headers: { "xi-api-key": keyOf(env) } });
  return res.ok || res.status === 404;
}
