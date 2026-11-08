// Turns the seed data into idempotent statements that run the same on D1 and Postgres. Imports nothing, so
// scripts/seed-crossroads.mjs can load it straight into Node; the data files are passed in.
type Line = { lane: string; kind: string; text: string };
type Trail = { lane: string; role: string; steps: string[]; skills: string[] };
type Employer = { slug: string; name: string; website: string; lane: string };
export type SeedStatement = { sql: string; params: (string | number)[] };

// fixed, so a seeded line keeps its id (and its me-too votes) across reruns
const SEEDED_AT = "2026-11-08T00:00:00.000Z";

// ids follow position within a lane and kind: append new examples at the end of a kind to keep older ids stable
function lineIds(lines: Line[]) {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const key = `${line.lane}_${line.kind}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return `ex_${key}_${n}`;
  });
}

export function seedStatements(lines: Line[], trails: Trail[], employers: Employer[]): SeedStatement[] {
  const ids = lineIds(lines);
  const lineRows = lines.map((line, i) => ({
    sql: "INSERT INTO road_patterns (id, lane, kind, text, is_seeded, created_at) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT (id) DO UPDATE SET text = excluded.text",
    params: [ids[i], line.lane, line.kind, line.text, SEEDED_AT],
  }));
  const trailRows = trails.map((trail, i) => ({
    sql: `INSERT INTO path_outcomes (id, user_id, lane, role, company_slug, steps_json, skills_json, is_seeded) VALUES (?, NULL, ?, ?, NULL, ?, ?, 1)
          ON CONFLICT (id) DO UPDATE SET steps_json = excluded.steps_json, skills_json = excluded.skills_json`,
    params: [`ex_trail_${trail.lane}_${i + 1}`, trail.lane, trail.role, JSON.stringify(trail.steps), JSON.stringify(trail.skills)],
  }));
  // an employer already researched keeps its id and facts; it only learns which road it sits on
  const employerRows = employers.map((e) => ({
    sql: `INSERT INTO companies (id, slug, name, website, tracked, lane) VALUES (?, ?, ?, ?, 0, ?)
          ON CONFLICT (slug) DO UPDATE SET lane = excluded.lane, website = coalesce(companies.website, excluded.website)`,
    params: [`co_${e.slug}`, e.slug, e.name, e.website, e.lane],
  }));
  return [...lineRows, ...trailRows, ...employerRows];
}
