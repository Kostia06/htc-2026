// The replay of one past session, as the phone and web read it: GET /api/voice/sessions/:id/replay and its audio.
import { callApi, NetworkError, SignedOutError } from '../headset/api.js'

async function authorized(path, token, fetchImpl) {
  const response = await callApi(path, { headers: { authorization: `Bearer ${token}` } }, fetchImpl)
  if (response.status === 401) throw new SignedOutError('this headset needs to sign in again')
  if (!response.ok) throw new NetworkError(response.status === 404 ? 'missing' : 'unavailable')
  return response
}

/** { audioUrl, recording, timing, durationSec, moments, transcript } */
export async function fetchReplay(token, sessionId, fetchImpl) {
  return (await authorized(`/api/voice/sessions/${encodeURIComponent(sessionId)}/replay`, token, fetchImpl)).json()
}

// Fetched whole and played from a blob: an <audio> element can't send the bearer token, and a practice call is a
// few minutes, so the file is small and seeks instantly once loaded.
export async function fetchReplayAudio(token, sessionId, fetchImpl) {
  return (await authorized(`/api/voice/sessions/${encodeURIComponent(sessionId)}/replay/audio`, token, fetchImpl)).blob()
}
