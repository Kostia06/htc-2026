import type { Env } from "../env";
import { freshResearch, reportedQuestions, targetCompanies } from "./company-sources";
import { type Pusher, pushPending } from "./push";
import { chooseToSay, DAY_MS } from "./rules";
import { claimCheck, dueForCheck, loadSettings } from "./settings";
import { feedMatches, finishedReports, roadNudge, savedDeadlines, tailoredResumes } from "./sources";
import { countSince, insertNotifications, saidKeys } from "./store";
import type { Candidate } from "./types";

// an app opening checks at most this often; a write that may have produced news checks straight away
export const OPEN_GAP_MS = 10 * 60 * 1000;
// the cron runs every 6 hours; a little under that so every run reaches the people it reached last time
const CRON_GAP_MS = 5 * 60 * 60 * 1000;
const CRON_BATCH = 50;

async function candidatesFor(env: Env, userId: string, now: Date): Promise<Candidate[]> {
  const companies = await targetCompanies(env, userId);
  const groups = await Promise.all([
    finishedReports(env, userId, now),
    tailoredResumes(env, userId, now),
    savedDeadlines(env, userId, now),
    roadNudge(env, userId, now),
    reportedQuestions(env, companies, now),
    freshResearch(env, companies, now),
    feedMatches(env, userId),
  ]);
  return groups.flat();
}

/** Decides what is worth telling this person right now and records it; returns how many new notifications it made. */
export async function generateFor(env: Env, userId: string, now = new Date()): Promise<number> {
  const [settings, said, sentToday, candidates] = await Promise.all([
    loadSettings(env, userId),
    saidKeys(env, userId),
    countSince(env, userId, new Date(now.getTime() - DAY_MS)),
    candidatesFor(env, userId, now),
  ]);
  const chosen = chooseToSay(candidates, { said, sentToday, disabled: settings.disabled });
  return insertNotifications(env, userId, chosen, now);
}

type RefreshOptions = { now?: Date; minGapMs?: number; pusher?: Pusher | null };

/** Generate, then push what's new; skipped when someone else checked this person within `minGapMs`. */
export async function refreshNotifications(env: Env, userId: string, options: RefreshOptions = {}) {
  const now = options.now ?? new Date();
  if (!(await claimCheck(env, userId, now, options.minGapMs ?? 0))) return { created: 0, pushed: 0 };
  const created = await generateFor(env, userId, now);
  const { pushed } = await pushPending(env, userId, now, options.pusher);
  return { created, pushed };
}

/** The cron's pass: one person at a time, so one broken profile can't take the whole batch down. */
export async function runNotificationCron(env: Env, now = new Date(), pusher?: Pusher | null) {
  let created = 0;
  for (const userId of await dueForCheck(env, now, CRON_GAP_MS, CRON_BATCH)) {
    try {
      created += (await refreshNotifications(env, userId, { now, minGapMs: CRON_GAP_MS, pusher })).created;
    } catch (e) {
      console.error(`notifications for ${userId.slice(0, 8)} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return created;
}

/** For handlers that just wrote something worth telling: runs after the response, never fails the request. */
export function notifyAfterWrite(env: Env, userId: string, waitUntil: (work: Promise<unknown>) => void) {
  waitUntil(refreshNotifications(env, userId).catch((e) => console.error(`notify after write failed: ${e instanceof Error ? e.message : String(e)}`)));
}
