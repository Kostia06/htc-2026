import type { Launch } from "./api";

export type LaunchListener = (launch: Launch) => void;

const listeners = new Set<LaunchListener>();

/**
 * Called when the phone sends a practice session to this headset. The scene registers once and starts the
 * session from the launch (`mode`, `companySlug`, `role`, `stepId` go straight into `POST /api/voice/sessions`):
 *
 *   import { onLaunch } from "./headset";
 *   useEffect(() => onLaunch((launch) => startPractice(launch)), []);
 *
 * Returns the unsubscribe function. Without a listener the shell shows "Starting…" and returns to the menu.
 */
export function onLaunch(listener: LaunchListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Hands a launch to every listener; returns how many there were. */
export function emitLaunch(launch: Launch) {
  for (const listener of listeners) listener(launch);
  return listeners.size;
}

const KNOWN_COMPANIES: Record<string, string> = { atb: "ATB", benevity: "Benevity", "neo-financial": "Neo Financial", helcim: "Helcim" };

const titleCase = (slug: string) => slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

/** The line shown while the session starts: "Starting your interview with ATB…" */
export function describeLaunch(launch: Launch) {
  const company = launch.companySlug ? (KNOWN_COMPANIES[launch.companySlug] ?? titleCase(launch.companySlug)) : null;
  return company ? `Starting your interview with ${company}…` : "Starting your interview…";
}
