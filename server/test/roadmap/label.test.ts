import { describe, expect, it } from "vitest";
import { labelStep } from "../../src/roadmap/label";

const profile = "Skills: Python (Built a Flask API for 2,000 users). Education: BSc Computer Science.";

describe("labelStep", () => {
  it("is ready now when every need is backed by the profile, or nothing is needed", () => {
    expect(labelStep([{ need: "Python", evidence: "Built a Flask API" }], profile)).toBe("ready_now");
    expect(labelStep([], profile)).toBe("ready_now");
  });

  it("is a stretch when exactly one need is missing", () => {
    expect(labelStep([{ need: "Python", evidence: "Flask API" }, { need: "Docker" }], profile)).toBe("stretch");
  });

  it("doesn't take the model's word: evidence that isn't in the profile counts as missing", () => {
    expect(labelStep([{ need: "Kubernetes", evidence: "Ran Kubernetes clusters" }], profile)).toBe("stretch");
  });

  it("is long term when two or more needs are missing", () => {
    expect(labelStep([{ need: "Docker" }, { need: "AWS certification" }, { need: "Python", evidence: "Python" }], profile)).toBe("long_term");
  });
});
