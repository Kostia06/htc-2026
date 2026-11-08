const API_URL = (import.meta.env.VITE_RAVEN_API_URL ?? "http://localhost:8799").replace(/\/+$/, "");

export type NetworkProblem = "offline" | "unavailable";

export class NetworkError extends Error {
  constructor(readonly problem: NetworkProblem) {
    super(`request failed: ${problem}`);
  }
}

export async function callApi(path: string, init: RequestInit = {}) {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    // fetch only says "network error"; navigator.onLine tells a dead Wi-Fi apart from a server we can't reach
    throw new NetworkError(navigator.onLine ? "unavailable" : "offline");
  }
}
