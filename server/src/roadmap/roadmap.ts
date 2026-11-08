import type { AgentDeps } from "../agents/core/types";
import { getProfile } from "../memory/profile/store";
import { backgroundOf, goalOf } from "./background";
import { draftUnit, type UnitRequest } from "./generate";
import { countUnits, loadUnits, progress, saveUnit, stepTitles } from "./store";
import { templateUnit } from "./templates";
import type { RoadmapPage, Unit } from "./types";

export const PAGE_UNITS = 2;
// a generous ceiling so a runaway client can't make the model plan forever
export const MAX_UNITS = 30;
const CLAIM_MS = 60_000;
const POLL_MS = 400;

export type RoadmapOptions = {
  // how long a person waits for the model before getting the template
  deadlineMs: number;
  // how long the background pre-generation of the next unit may take
  backgroundDeadlineMs: number;
  waitUntil(work: Promise<unknown>): void;
};

type Context = { deps: AgentDeps; userId: string; goal: string; background: string };

// null when the cursor points past what can exist
export async function roadmapPage(deps: AgentDeps, userId: string, cursor: number, options: RoadmapOptions): Promise<RoadmapPage | null> {
  const profile = await getProfile(deps.env, userId);
  const ctx: Context = { deps, userId, goal: goalOf(profile), background: backgroundOf(profile) };
  if (cursor >= MAX_UNITS || cursor > (await countUnits(deps.env, userId))) return null;

  let units = await loadUnits(deps.env, userId, cursor, PAGE_UNITS);
  if (units.length === 0) units = [await ensureUnit(ctx, cursor, options.deadlineMs)];

  const end = cursor + units.length;
  if (end < MAX_UNITS && end >= (await countUnits(deps.env, userId))) options.waitUntil(pregenerate(ctx, end, options.backgroundDeadlineMs));
  return { goal: ctx.goal, summary: await progress(deps.env, userId), units, nextCursor: end < MAX_UNITS ? String(end) : null };
}

const claimKey = (ctx: Context, index: number) => `${ctx.userId}:${index}`;
const claim = (ctx: Context, index: number) => ctx.deps.services.claimCooldown("roadmap-unit", claimKey(ctx, index), CLAIM_MS);

// someone is waiting: if a pre-generation is already on it, wait for that, and fall back to the template at the deadline
async function ensureUnit(ctx: Context, index: number, deadlineMs: number): Promise<Unit> {
  if (await claim(ctx, index)) return produce(ctx, index, deadlineMs);
  const ready = await waitForUnit(ctx, index, deadlineMs);
  if (ready) return ready;
  await saveUnit(ctx.deps.env, ctx.userId, index, templateUnit(ctx.goal, index));
  return loadOne(ctx, index);
}

async function pregenerate(ctx: Context, index: number, deadlineMs: number) {
  if (await claim(ctx, index)) await produce(ctx, index, deadlineMs);
}

async function produce(ctx: Context, index: number, deadlineMs: number): Promise<Unit> {
  const request: UnitRequest = { ...ctx, index, previous: await stepTitles(ctx.deps.env, ctx.userId) };
  // a unit saved meanwhile wins; this one is dropped, so the stored path never changes under the person
  await saveUnit(ctx.deps.env, ctx.userId, index, await draftUnit(ctx.deps, request, deadlineMs));
  return loadOne(ctx, index);
}

async function waitForUnit(ctx: Context, index: number, deadlineMs: number): Promise<Unit | null> {
  for (let waited = 0; waited < deadlineMs; waited += POLL_MS) {
    const [unit] = await loadUnits(ctx.deps.env, ctx.userId, index, 1);
    if (unit) return unit;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return null;
}

async function loadOne(ctx: Context, index: number): Promise<Unit> {
  const [unit] = await loadUnits(ctx.deps.env, ctx.userId, index, 1);
  if (!unit) throw new Error(`roadmap unit ${index} was saved but can't be read`);
  return unit;
}
