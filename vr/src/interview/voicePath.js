// Which voice runs the interview, decided once from what POST /api/voice/sessions
// returned (session.js maps it to `started.voice`).
//
//   agent -> the ElevenLabs realtime agent: its voice, its turn-taking. Nothing of
//            the local speech stack (TTS bridge, speechSynthesis, /next) runs.
//   local -> no realtime provider (example data, or one this page cannot drive):
//            the local voice and the server's /next lines.
//   error -> ElevenLabs was offered but cannot be used. Never quietly swapped for
//            the computer voice: the candidate sees why and can try again.
export function voicePathOf(started) {
  const voice = started?.voice
  if (!voice) return { kind: 'local' }
  if (voice.signedUrl) return { kind: 'agent' }
  if (voice.provider === 'elevenlabs' || voice.kind === 'elevenlabs') {
    return { kind: 'error', message: 'The interviewer could not start its voice. Try again.' }
  }
  return { kind: 'local' }
}
