import { emptyProfile } from "../../src/memory/profile/patch";
import type { Profile } from "../../src/memory/profile/types";
import type { PlanInputs } from "../../src/voice/plan";

export const ACME_COMPANY = { id: "c1", slug: "acme", name: "Acme" };

export const profile: Profile = {
  ...emptyProfile(),
  targetRoles: ["Junior data analyst"],
  skills: [{ name: "SQL", source: "resume", evidence: "Wrote SQL reports in Postgres for the lending team" }],
  experience: [
    { role: "Software Developer Co-op", org: "ATB Financial", highlights: ["Built a Python Flask API that served 2,000 internal users"] },
  ],
};

export const inputs = (over: Partial<PlanInputs> = {}): PlanInputs => ({
  role: "Junior data analyst",
  company: ACME_COMPANY,
  reportedQuestions: [
    { text: "Walk me through a SQL query you're proud of.", last_reported_at: "2026-10" },
    { text: "How do you handle messy data?", last_reported_at: "2026-09" },
  ],
  facts: [
    { kind: "news", text: "Acme opened a Calgary office in 2026." },
    { kind: "tech", text: "Acme's analytics team uses dbt and Snowflake." },
  ],
  profile,
  ...over,
});
