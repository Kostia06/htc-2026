import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

const TABLES = ["company_facts", "experiences", "submission_log", "interview_sessions", "companies", "occupations", "postings", "courses"];

beforeEach(async () => {
  await env.DB.batch(TABLES.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
});
