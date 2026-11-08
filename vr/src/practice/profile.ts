import { callApi } from "../session/http";

export type PracticeProfile = { headline?: string; targetRoles: string[] };

export class SignedOutError extends Error {}

export async function fetchProfile(token: string, signal: AbortSignal): Promise<PracticeProfile> {
  const response = await callApi("/api/me/profile", { headers: { Authorization: `Bearer ${token}` }, signal });
  // a headset token lasts twelve hours; after that the person pairs again
  if (response.status === 401) throw new SignedOutError("headset session ended");
  if (!response.ok) throw new Error(`profile request failed: ${response.status}`);
  const { profile } = (await response.json()) as { profile: Partial<PracticeProfile> };
  return { headline: profile.headline, targetRoles: profile.targetRoles ?? [] };
}
