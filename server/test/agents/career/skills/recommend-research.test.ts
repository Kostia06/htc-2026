import { describe, expect, it } from "vitest";
import { recommendResearch } from "../../../../src/agents/career/skills/recommend-research";
import { fetched, profileCall } from "../../../recommend/tool-calls";

const UREX = "https://www.ucalgary.ca/experiential-learning/undergraduate-research/pure";
const LAB = "https://example.ucalgary.ca/hci-lab/prospective-students";

const pages = [
  fetched(UREX, "UREX Award. Eligible students are in good standing with a cumulative GPA of at least 2.0 and continuing in the following fall."),
  fetched(LAB, "Prospective students: we work on accessible interfaces. Undergraduates with HCI coursework are welcome to email us. We are hiring one undergraduate research assistant for summer 2027."),
];

const urex = {
  title: "UREX Award",
  source_url: UREX,
  listing: "program",
  requirements: [
    { quote: "cumulative GPA of at least 2.0", kind: "hard", met: "unknown" },
    { quote: "continuing in the following fall", kind: "hard", met: "unknown" },
  ],
  next_step: "Find a supervisor before 2027-01-25.",
  path: "Raise your GPA, then apply next year.",
  question: "Will you still be an undergraduate next fall, and is your cumulative GPA at least 2.0?",
};

const lab = {
  title: "HCI Lab",
  source_url: LAB,
  listing: "lab",
  opening_quote: "",
  requirements: [{ quote: "HCI coursework", kind: "required", met: "yes", evidence: "CPSC 481" }],
  next_step: "Read their latest paper and email asking for a short meeting.",
  path: "Take CPSC 481 first.",
};

type Output = { items: { title: string; level: string; note?: string }[]; question?: string };
const finalize = (items: unknown[], profileText = "Took CPSC 481.") =>
  recommendResearch.finalize!({ items }, [profileCall({ summary: profileText }), ...pages]) as Output;

describe("recommend-research skill", () => {
  it("runs on the app only", () => {
    expect(recommendResearch.platforms).toEqual(["app"]);
  });

  it("case 5: unknown GPA and graduation means can't tell, and asks the one question", () => {
    const output = finalize([urex]);
    expect(output.items[0].level).toBe("cant_tell");
    expect(output.question).toBe(urex.question);
  });

  it("says a program is not an opening", () => {
    const output = finalize([{ ...urex, requirements: urex.requirements.map((r) => ({ ...r, met: "yes", evidence: "Took CPSC 481" })) }]);
    expect(output.items[0].note).toContain("not a job opening");
  });

  it("never calls a lab ready now unless it posts an opening", () => {
    expect(finalize([lab]).items[0].level).toBe("stretch");
  });

  it("a lab that quotes a real opening can be ready now", () => {
    const open = { ...lab, opening_quote: "We are hiring one undergraduate research assistant for summer 2027" };
    expect(finalize([open]).items[0].level).toBe("ready_now");
  });

  it("refuses a question that is really two", () => {
    const output = finalize([{ ...urex, question: "What is your GPA? When do you graduate?" }]);
    expect(output.question?.match(/\?/g)).toHaveLength(1);
  });
});
