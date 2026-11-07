import { describe, expect, it } from "vitest";
import { readProfile, updateProfileTool } from "../../../src/agents/tools/profile";
import { fakeMemory, toolContext } from "../fakes";

describe("profile tools", () => {
  it("update_profile writes the parsed patch to this person's profile only", async () => {
    const memory = fakeMemory();
    const out = await updateProfileTool.run({ skills: [{ name: "SQL", source: "resume", evidence: "wrote SQL reports" }] }, toolContext({ memory }));
    expect(out).toMatchObject({ updated: true });
    expect((await memory.profile()).skills.map((s) => s.name)).toEqual(["SQL"]);
  });

  it("update_profile refuses an empty or malformed patch", async () => {
    const memory = fakeMemory();
    expect(await updateProfileTool.run({}, toolContext({ memory }))).toMatchObject({ updated: false });
    expect(await updateProfileTool.run({ skills: "lots" }, toolContext({ memory }))).toMatchObject({ updated: false });
  });

  it("profile reads back what was stored", async () => {
    const memory = fakeMemory();
    await memory.updateProfile({ goals: ["Land a co-op"] });
    expect(await readProfile.run({}, toolContext({ memory }))).toMatchObject({ goals: ["Land a co-op"] });
  });
});

describe("update_profile grounding", () => {
  const resume = "Built a Flask API for 2,000 students.\nWrote SQL reports in Postgres.";

  it("keeps resume skills whose evidence is quoted from the uploaded text", async () => {
    const memory = fakeMemory();
    const out = await updateProfileTool.run(
      { skills: [{ name: "Python", source: "resume", evidence: "built a  Flask API" }] },
      toolContext({ memory, groundingText: resume }),
    );
    expect(out).toMatchObject({ updated: true, dropped: 0 });
    expect((await memory.profile()).skills.map((s) => s.name)).toEqual(["Python"]);
  });

  it("drops resume skills with invented or missing evidence", async () => {
    const memory = fakeMemory();
    const out = await updateProfileTool.run(
      { skills: [{ name: "Kubernetes", source: "resume", evidence: "Ran Kubernetes clusters" }, { name: "Java", source: "resume" }] },
      toolContext({ memory, groundingText: resume }),
    );
    expect(out).toMatchObject({ updated: false, dropped: 2 });
    expect((await memory.profile()).skills).toEqual([]);
  });
});
