import type { HeadsetSession } from "../pairing/api";
import { NetworkError, callApi } from "../session/http";

export type LaunchMode = "interview" | "networking";
/** What the phone asked this headset to start; the same fields `POST /api/voice/sessions` takes, plus the roadmap step. */
export type Launch = { mode: LaunchMode; companySlug?: string; role?: string; stepId?: string };

/** The server no longer knows this headset (revoked, or the credential was spent): back to the keypad. */
export class SignedOutError extends Error {}

// how long one poll stays open on the server; it answers early when a launch arrives
export const LONG_POLL_SECONDS = 20;

export async function refreshSession(refreshToken: string): Promise<HeadsetSession> {
  const response = await callApi("/api/headset/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (response.status === 401) throw new SignedOutError("this headset needs to sign in again");
  if (!response.ok) throw new NetworkError("unavailable");
  return response.json();
}

/** One long poll. Resolves with the launch, or null when the wait ran out with nothing to start. */
export async function pollLaunch(session: HeadsetSession, signal: AbortSignal): Promise<Launch | null> {
  const query = new URLSearchParams({ wait: String(LONG_POLL_SECONDS) });
  if (session.deviceId) query.set("device", session.deviceId);
  const response = await callApi(`/api/headset/launch?${query}`, { headers: { Authorization: `Bearer ${session.token}` }, signal });
  if (response.status === 401) throw new SignedOutError("this headset needs to sign in again");
  if (!response.ok) throw new NetworkError("unavailable");
  const { launch } = (await response.json()) as { launch: Launch | null };
  return launch;
}
