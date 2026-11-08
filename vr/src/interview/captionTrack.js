// The caption under the interviewer, as a small state machine.
//
// The voice agent reports the candidate's words only after they finish
// (onUserText) and the interviewer's whole reply the moment it starts
// (onAgentText). Showing whichever arrived last put the candidate's words on
// screen while the interviewer was already talking. Here the two never share
// the line: while the interviewer speaks only their words show, a few at a time
// and paced to the speech; the candidate's line ("You: …") shows only during
// their own turn and goes the moment the interviewer starts.

const CHARS_PER_SECOND = 15 // ElevenLabs voices speak at roughly 150-170 wpm
const MAX_WORDS = 7
// Streamed audio can underrun for a moment mid-reply; a gap this short is the
// same reply, not the end of it.
export const SPEECH_GAP_MS = 700

export function chunkCaption(text, maxWords = MAX_WORDS) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  const chunks = []
  let current = []
  for (const word of words) {
    current.push(word)
    // break at the end of a sentence or clause, or when the piece is full
    if (current.length >= maxWords || (/[.!?;:]$/.test(word) && current.length >= 2)) {
      chunks.push(current.join(' '))
      current = []
    }
  }
  if (current.length) chunks.push(current.join(' '))
  return chunks
}

// Which piece is being spoken `elapsedMs` into the reply. Each piece gets time
// in proportion to its length; past the estimate the last piece stays up.
export function chunkAt(chunks, elapsedMs) {
  if (!chunks.length) return ''
  let end = 0
  for (const chunk of chunks) {
    end += ((chunk.length + 1) / CHARS_PER_SECOND) * 1000
    if (elapsedMs < end) return chunk
  }
  return chunks[chunks.length - 1]
}

export const initialCaption = Object.freeze({
  agentText: '',
  startedAt: null, // when the interviewer's audio began
  speaking: false,
  stoppedAt: null,
  userText: '',
})

function agentActive(state, now) {
  if (!state.agentText) return false
  if (state.speaking) return true
  // text that arrived before its audio, or a short underrun mid-reply
  return state.stoppedAt == null || now - state.stoppedAt < SPEECH_GAP_MS
}

export function captionReducer(state, event) {
  const now = event.now ?? 0
  switch (event.type) {
    case 'agentText': {
      if (!event.text) return state
      // more of the reply already underway extends it; otherwise a new reply
      const midReply = state.speaking || (state.stoppedAt != null && now - state.stoppedAt < SPEECH_GAP_MS)
      const continuing = state.startedAt != null && midReply
      return {
        ...state,
        agentText: continuing ? [state.agentText, event.text].filter(Boolean).join(' ') : event.text,
        startedAt: continuing ? state.startedAt : state.speaking ? now : null,
        stoppedAt: continuing ? state.stoppedAt : null,
        userText: '',
      }
    }
    case 'speaking': {
      if (event.speaking) {
        const resumed = state.stoppedAt != null && now - state.stoppedAt < SPEECH_GAP_MS
        // text that arrived just ahead of its audio belongs to this reply
        const textAhead = state.startedAt == null && state.stoppedAt == null
        return {
          ...state,
          agentText: resumed || textAhead ? state.agentText : '',
          speaking: true,
          startedAt: resumed && state.startedAt != null ? state.startedAt : now,
          stoppedAt: null,
          userText: '',
        }
      }
      if (!state.speaking) return state
      return { ...state, speaking: false, stoppedAt: now }
    }
    case 'userText': {
      // a late transcript of the last answer must not appear over the reply
      const replying = state.speaking || (state.startedAt != null && agentActive(state, now))
      if (replying) return state
      return { ...state, agentText: '', startedAt: null, userText: event.text ?? '' }
    }
    case 'reset':
      return initialCaption
    default:
      return state
  }
}

// What the caption shows at `now`.
export function captionText(state, now) {
  if (agentActive(state, now)) {
    const elapsed = state.startedAt == null ? 0 : now - state.startedAt
    return chunkAt(chunkCaption(state.agentText), elapsed)
  }
  return state.userText ? `You: ${state.userText}` : ''
}

// True while the shown text can still change with time alone.
export function captionTicking(state, now) {
  return agentActive(state, now)
}
