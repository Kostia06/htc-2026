import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { deleteProfile, getProfile, updateProfile } from "../../../src/memory/profile/store";

describe("profile store", () => {
  it("starts empty and round-trips an update", async () => {
    expect((await getProfile(env, "p1")).skills).toEqual([]);
    await updateProfile(env, "p1", { skills: [{ name: "Python", source: "resume", evidence: "Flask API" }] });
    expect((await getProfile(env, "p1")).skills.map((s) => s.name)).toEqual(["Python"]);
  });

  it("stores only ciphertext", async () => {
    await updateProfile(env, "p2", { headline: "Aspiring data analyst" });
    const row = await env.DB.prepare("SELECT ciphertext FROM user_profiles WHERE user_id = ?").bind("p2").first<{ ciphertext: string }>();
    expect(row?.ciphertext).not.toContain("analyst");
  });

  it("never shows one person's profile to another", async () => {
    await updateProfile(env, "p3", { goals: ["Become a nurse"] });
    expect((await getProfile(env, "p4")).goals).toEqual([]);
  });

  it("deletes the whole profile", async () => {
    await updateProfile(env, "p5", { goals: ["Move to Calgary"] });
    expect(await deleteProfile(env, "p5")).toBe(true);
    expect((await getProfile(env, "p5")).goals).toEqual([]);
  });
});
