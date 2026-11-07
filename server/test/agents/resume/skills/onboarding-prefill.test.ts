import { describe, expect, it } from "vitest";
import { onboardingPrefill } from "../../../../src/agents/resume/skills/onboarding-prefill";

const readCall = { name: "read_document", args: {}, result: { format: "pdf", text: "<user-document>\nBuilt a Python Flask API for 2,000 users\n</user-document>" } };

describe("onboarding-prefill", () => {
  it("reads documents but never writes the profile itself", () => {
    expect(onboardingPrefill.tools).toEqual(["read_document", "profile"]);
    expect(onboardingPrefill.platforms).toEqual(["app"]);
  });

  it("keeps grounded skills, drops invented ones and cleans the draft", () => {
    const draft = {
      headline: "Student — jordan@example.com",
      skills: [
        { name: "Python", source: "resume", evidence: "Built a Python  Flask API" },
        { name: "Kubernetes", source: "resume", evidence: "Ran Kubernetes clusters" },
      ],
      missing: ["Which role are you aiming for?"],
    };
    const out = onboardingPrefill.finalize?.(draft, [readCall] as never) as Record<string, unknown>;
    expect((out.draft as { skills: { name: string }[] }).skills.map((s) => s.name)).toEqual(["Python"]);
    expect((out.draft as { headline: string }).headline).not.toContain("jordan@example.com");
    expect(out).toMatchObject({ droppedClaims: 1, missing: ["Which role are you aiming for?"] });
  });

  it("returns an empty draft when no document was read", () => {
    const out = onboardingPrefill.finalize?.({ skills: [{ name: "Python", source: "resume", evidence: "x" }], missing: [] }, []) as Record<string, unknown>;
    expect((out.draft as { skills?: unknown[] }).skills ?? []).toEqual([]);
  });
});
