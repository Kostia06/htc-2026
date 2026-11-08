import type { CompletedDay, Step } from "./types";

const DAY_MS = 86_400_000;

// the calendar day an instant falls on where the person is, as YYYY-MM-DD; a bad zone falls back to UTC
export function dayOf(iso: string, timeZone: string): string {
  const date = new Date(iso);
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// newest day first; steps within a day keep the order given (newest first from the store)
export function groupByDay(steps: Step[], timeZone: string): CompletedDay[] {
  const days: CompletedDay[] = [];
  for (const step of steps) {
    if (!step.completedAt) continue;
    const day = dayOf(step.completedAt, timeZone);
    const last = days[days.length - 1];
    if (last?.day === day) last.steps.push(step);
    else days.push({ day, steps: [step] });
  }
  return days;
}

// consecutive days with something done, counted back from today; yesterday still counts so a streak isn't lost before the day is over
export function streakDays(completedAt: string[], timeZone: string, now = new Date()): number {
  const days = new Set(completedAt.map((at) => dayOf(at, timeZone)));
  const today = dayOf(now.toISOString(), timeZone);
  let cursor = now;
  if (!days.has(today)) cursor = new Date(now.getTime() - DAY_MS);
  let streak = 0;
  while (days.has(dayOf(cursor.toISOString(), timeZone))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}
