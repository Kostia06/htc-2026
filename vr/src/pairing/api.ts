export type Pairing = { code: string; pollToken: string; expiresAt: string; link: string };
export type PollResult = { status: "pending" } | { status: "approved"; token: string } | { status: "expired" };
export type PairingProblem = "offline" | "rate_limited" | "unavailable";

export class PairingError extends Error {
  constructor(readonly problem: PairingProblem) {
    super(`pairing failed: ${problem}`);
  }
}

const API_URL = (import.meta.env.VITE_RAVEN_API_URL ?? "http://localhost:8799").replace(/\/+$/, "");

async function send(path: string, init: RequestInit) {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    // fetch only says "network error"; navigator.onLine tells a dead Wi-Fi apart from a server we can't reach
    throw new PairingError(navigator.onLine ? "unavailable" : "offline");
  }
}

function failureFor(response: Response) {
  return new PairingError(response.status === 429 ? "rate_limited" : "unavailable");
}

export async function createPairing(signal: AbortSignal): Promise<Pairing> {
  const response = await send("/api/pairing", { method: "POST", signal });
  if (!response.ok) throw failureFor(response);
  return response.json();
}

export async function checkPairing(pairing: Pairing, signal: AbortSignal): Promise<PollResult> {
  const response = await send(`/api/pairing/${encodeURIComponent(pairing.code)}`, {
    headers: { "X-Pairing-Token": pairing.pollToken },
    signal,
  });
  // 404 means the server already cleaned the code up; either way the headset needs a fresh one
  if (response.status === 410 || response.status === 404) return { status: "expired" };
  if (!response.ok) throw failureFor(response);
  return response.json();
}

export const problemOf = (error: unknown): PairingProblem => (error instanceof PairingError ? error.problem : "unavailable");
