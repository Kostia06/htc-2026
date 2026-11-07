import { describe, expect, it } from "vitest";
import { recommendJobs, recommendJobsWith } from "../../../src/agents/skills/recommend-jobs";
import { fetched, profileCall } from "../../recommend/tool-calls";

const COOP_URL = "https://jobs.example.com/coop-dev";
const SENIOR_URL = "https://jobs.example.com/senior-de";

const profile = profileCall({
  summary: "3rd-year UCalgary Computer Science student. Completed CPSC 331. 4-month co-op using Python and SQL. GPA 3.3.",
  goals: ["My dream is to be a senior data engineer at Shopify"],
});
const pages = [
  fetched(COOP_URL, "Co-op Developer. Required: currently enrolled in CS or related; Python; SQL. Preferred: AWS."),
  fetched(SENIOR_URL, "Senior Data Engineer. Required: 5+ years of data engineering experience; SQL."),
];

const person = { job_zone: 3, experience: [{ quote: "4-month co-op using Python and SQL", kind: "work", years: 0.33 }] };

const coop = {
  title: "Co-op Developer",
  source_url: COOP_URL,
  separates_required: true,
  job_zone: 3,
  requirements: [
    { quote: "currently enrolled in CS or related", kind: "hard", met: "yes", evidence: "3rd-year UCalgary Computer Science student" },
    { quote: "Python", kind: "required", met: "yes", evidence: "co-op using Python" },
    { quote: "SQL", kind: "required", met: "yes", evidence: "Python and SQL" },
    { quote: "AWS", kind: "preferred", met: "no" },
    { quote: "Kubernetes", kind: "required", met: "no" },
  ],
  next_step: "You're a perfect fit. Apply and mention your co-op.",
  path: "Take a cloud course.",
};

const senior = {
  title: "Senior Data Engineer at Shopify",
  source_url: SENIOR_URL,
  separates_required: true,
  job_zone: 4,
  experience_required: { years: 5, quote: "5+ years of data engineering experience" },
  requirements: [
    { quote: "5+ years of data engineering experience", kind: "required", met: "no" },
    { quote: "SQL", kind: "required", met: "yes", evidence: "Python and SQL" },
  ],
  next_step: "Definitely apply.",
  path: "Take CPSC 471 for databases, then a data co-op, then junior data roles.",
};

type Item = { title: string; level: string; next_step: string; missing: { requirement: string }[]; counts: { summary: string } };
const finalize = (items: unknown[], toolCalls = [profile, ...pages]) =>
  recommendJobs.finalize!({ person, items }, toolCalls) as { items: Item[]; question?: string };

describe("recommend-jobs skill", () => {
  it("runs on the app only and reads the profile", () => {
    expect(recommendJobs.platforms).toEqual(["app"]);
    expect(recommendJobs.tools).toContain("profile");
  });

  it("case 1: assigns ready now in code, drops a requirement the posting never stated and strips banned phrases", () => {
    const [item] = finalize([coop]).items;
    expect(item.level).toBe("ready_now");
    expect(item.counts.summary).toBe("3 of 3 required");
    expect(item.missing.map((m) => m.requirement)).toEqual(["AWS"]);
    expect(item.next_step).toBe("Apply and mention your co-op.");
  });

  it("case 8: a dream role is still long term, with its path as the next step", () => {
    const { items } = finalize([coop, senior]);
    const dream = items.find((i) => i.title.includes("Shopify"))!;
    expect(dream.level).toBe("long_term");
    expect(dream.next_step).toContain("CPSC 471");
    expect(JSON.stringify(items)).not.toMatch(/definitely|perfect fit/i);
    expect(items[0].title).toBe("Co-op Developer");
  });

  it("drops a posting it never fetched", () => {
    const { items } = finalize([{ ...coop, source_url: "https://jobs.example.com/made-up" }]);
    expect(items).toEqual([]);
  });

  it("reads the profile through the injected reader", () => {
    const skill = recommendJobsWith(() => ({ text: "", goals: [] }));
    const output = skill.finalize!({ person, items: [coop] }, [profile, ...pages]) as { items: Item[] };
    expect(output.items[0].level).toBe("cant_tell");
  });

  it("asks exactly one question when it can't tell", () => {
    const unclear = { ...coop, requirements: coop.requirements.map((r) => (r.kind === "hard" ? { ...r, met: "unknown" } : r)), question: "" };
    const output = finalize([unclear]);
    expect(output.items[0].level).toBe("cant_tell");
    expect(output.question?.match(/\?/g)).toHaveLength(1);
    expect(output.question).toContain("currently enrolled in CS or related");
  });
});
