import type { Env } from "../env";
import type { Debrief } from "../voice/debrief";
import { listTurns, type StoredTurn } from "../voice/store";
import { alignTurns, type Span, type TimedLine } from "./align";
import { type Conversation, fetchConversation, type RecordingStatus } from "./elevenlabs";
import { buildMoments, type Moment, separate } from "./moments";
import { loadReplayRecord } from "./store";
import { hasLiveTimestamps, lastTimestamp, liveSpans, withLeadIn } from "./timing";

export type Replay = {
  /** Where to fetch the recording, with the same sign-in; null when there is none to play. */
  audioUrl: string | null;
  recording: RecordingStatus;
  /** "seconds": every t is seconds into the call. "order": t is the answer's position, for sessions with no recording. */
  timing: "seconds" | "order";
  durationSec: number | null;
  moments: Moment[];
  transcript: TimedLine[];
};

// without a recording the replay is the transcript we stored, one question and answer per step
function fromTurnsOnly(turns: StoredTurn[], report: Debrief | null): Replay {
  const spans: Span[] = turns.map((_, i) => ({ start: i, end: i + 1 }));
  const transcript = turns.flatMap((turn, i): TimedLine[] => [
    { t: i, speaker: "agent", text: turn.question },
    { t: i, speaker: "person", text: turn.answer },
  ]);
  return { audioUrl: null, recording: "none", timing: "order", durationSec: null, moments: buildMoments(turns, report, spans, []), transcript };
}

// until ElevenLabs finishes its transcript, the answers we scored stand in, at the times the client stamped them
function liveTranscript(turns: StoredTurn[]): TimedLine[] {
  return turns.flatMap((turn): TimedLine[] => [
    { t: withLeadIn(turn.answerStartSec ?? 0), speaker: "agent", text: turn.question },
    { t: turn.answerStartSec ?? 0, speaker: "person", text: turn.answer },
  ]);
}

export function replayFrom(sessionId: string, turns: StoredTurn[], report: Debrief | null, conversation: Conversation | null): Replay {
  const live = hasLiveTimestamps(turns);
  if (!conversation || (conversation.lines.length === 0 && !live)) {
    // ElevenLabs takes a moment after the call to finish the transcript; say so instead of "no recording"
    return { ...fromTurnsOnly(turns, report), recording: conversation?.status === "processing" ? "processing" : "none" };
  }
  const lines = conversation.lines.length > 0 ? conversation.lines : liveTranscript(turns);
  const durationSec = Math.max(conversation.durationSec, live ? lastTimestamp(turns) : 0);
  // live timestamps say exactly when each answer began; matching words against the transcript is the fallback for older sessions
  const spans = live ? liveSpans(turns, durationSec) : alignTurns(turns, conversation.lines, conversation.durationSec);
  return {
    audioUrl: conversation.status === "ready" ? `/api/voice/sessions/${sessionId}/replay/audio` : null,
    recording: conversation.status,
    timing: "seconds",
    durationSec,
    moments: separate(buildMoments(turns, report, spans, lines)),
    transcript: lines,
  };
}

// a recording that can't be reached right now shouldn't cost the person their report
async function safeFetch(env: Env, conversationId: string | null) {
  if (!conversationId) return null;
  try {
    return await fetchConversation(env, conversationId);
  } catch (error) {
    console.warn("voice replay: conversation fetch failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** The caller must already own the session. */
export async function buildReplay(env: Env, userId: string, sessionId: string): Promise<Replay> {
  const [turns, record] = await Promise.all([listTurns(env, userId, sessionId), loadReplayRecord(env, userId, sessionId)]);
  return replayFrom(sessionId, turns, record.report, await safeFetch(env, record.conversationId));
}
