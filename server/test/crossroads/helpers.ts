import { env } from "cloudflare:workers";
import { issueSession, verifySession } from "../../src/auth/session";
import { businessLines } from "../../src/crossroads/seed/lines-business";
import { peopleLines } from "../../src/crossroads/seed/lines-people";
import { techLines } from "../../src/crossroads/seed/lines-tech";
import { calgaryEmployers, seedTrails } from "../../src/crossroads/seed/roads";
import { seedStatements } from "../../src/crossroads/seed/statements";
import { deps as similarity } from "../../src/crossroads/similarity";
import { updateProfile } from "../../src/memory/profile/store";

const DIMS = 128;
const hash = (word: string) => [...word].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % DIMS;

// a bag-of-words stand-in for Workers AI: texts sharing words point the same way, so similarity is predictable
export function useFakeEmbeddings() {
  similarity.embedTexts = async (_env, texts) =>
    texts.map((text) => {
      const v = new Array<number>(DIMS).fill(0);
      for (const w of text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)) v[hash(w)] += 1;
      return v;
    });
}

export async function seedCrossroads() {
  const statements = seedStatements([...techLines, ...businessLines, ...peopleLines], seedTrails, calgaryEmployers);
  await env.DB.batch(statements.map((s) => env.DB.prepare(s.sql).bind(...s.params)));
  return statements.length;
}

export async function person(goal = "Junior data analyst") {
  const token = await issueSession(env.SESSION_SECRET);
  const id = (await verifySession(token, env.SESSION_SECRET))!;
  await updateProfile(env, id, { targetRoles: [goal] });
  return { token, id };
}

export const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;

export async function addRealLine(id: string, lane: string, text: string, voters: number) {
  await env.DB.prepare("INSERT INTO road_patterns (id, lane, kind, text, is_seeded, created_at) VALUES (?, ?, 'tip', ?, 0, ?)").bind(id, lane, text, new Date().toISOString()).run();
  for (let i = 0; i < voters; i++) {
    await env.DB.prepare("INSERT INTO road_pattern_votes (pattern_id, user_id, created_at) VALUES (?, ?, ?)").bind(id, `voter-${id}-${i}`, new Date().toISOString()).run();
  }
}
