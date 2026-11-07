import { describe, expect, it } from "vitest";
import { profileIntake } from "../../../src/agents/skills/profile-intake";
import { toolContext } from "../fakes";

describe("profile-intake", () => {
  it("only uses the profile tools and runs in the app", () => {
    expect(profileIntake.tools).toEqual(["profile", "update_profile"]);
    expect(profileIntake.platforms).toEqual(["app"]);
    expect(profileIntake.personal).toBe(true);
  });

  it("grounds the run in the text the person sent", () => {
    const input = { text: "Wrote SQL reports.", source: "resume" as const };
    expect(profileIntake.groundingText?.(input)).toBe("Wrote SQL reports.");
    expect(profileIntake.buildGoal(input, toolContext())).toContain("Wrote SQL reports.");
  });

  it("counts updates from what the tool actually saved", () => {
    const calls = [
      { name: "update_profile", args: {}, result: { updated: true, dropped: 1 } },
      { name: "update_profile", args: {}, result: { updated: false, dropped: 2 } },
    ];
    expect(profileIntake.finalize?.({ summary: "ok", missing: [] }, calls as never)).toMatchObject({ updates: 1, droppedClaims: 3 });
  });
});
