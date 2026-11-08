import { NetworkError, callApi } from "../session/http";

// a server from before remembered headsets sends only the first two fields; such a session lasts until `expiresAt`
export type HeadsetSession = {
  token: string;
  expiresAt: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  deviceId?: string;
  deviceName?: string;
};
export type ClaimProblem = "wrong" | "rate_limited" | "offline" | "unavailable";

export class ClaimError extends Error {
  constructor(readonly problem: ClaimProblem) {
    super(`claim failed: ${problem}`);
  }
}

function problemFor(status: number): ClaimProblem {
  if (status === 404 || status === 400) return "wrong";
  return status === 429 ? "rate_limited" : "unavailable";
}

export async function claimCode(code: string): Promise<HeadsetSession> {
  const response = await callApi("/api/pairing/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new ClaimError(problemFor(response.status));
  return response.json();
}

export function problemOf(error: unknown): ClaimProblem {
  if (error instanceof ClaimError || error instanceof NetworkError) return error.problem;
  return "unavailable";
}
