import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { encryptFor } from "../../../src/memory/private/crypto";
import { forget, listMemories, recall, remember } from "../../../src/memory/private/store";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

async function storedRows() {
  const { results } = await env.DB.prepare("SELECT * FROM user_memories").all<Record<string, unknown>>();
  return results;
}

async function setLastUsed(id: string, when: string) {
  await env.DB.prepare("UPDATE user_memories SET last_used_at = ? WHERE id = ?").bind(when, id).run();
}

describe("remember", () => {
  it("stores the memory encrypted, never as plain text", async () => {
    const memory = await remember(env, "alice", { kind: "goal", text: "  Land a backend internship  " });
    expect(memory).toMatchObject({ kind: "goal", text: "Land a backend internship", uses: 0 });

    const [row] = await storedRows();
    expect(row.user_id).toBe("alice");
    expect(JSON.stringify(row)).not.toContain("backend internship");
  });

  it("strips emails, phones and profile links but keeps the person's own name", async () => {
    const memory = await remember(env, "alice", {
      kind: "note",
      text: "Alice, reach me at alice@example.com or 403-555-1234, see linkedin.com/in/alice-dev",
    });
    expect(memory.text).toBe("Alice, reach me at [email] or [phone], see [profile]");
  });

  it("rejects empty and over-long text", async () => {
    await expect(remember(env, "alice", { kind: "note", text: "   " })).rejects.toThrow();
    await expect(remember(env, "alice", { kind: "note", text: "x".repeat(501) })).rejects.toThrow();
  });

  it("bumps uses instead of storing an exact duplicate", async () => {
    const first = await remember(env, "alice", { kind: "skill", text: "SQL joins" });
    const again = await remember(env, "alice", { kind: "skill", text: "SQL joins " });
    expect(again.id).toBe(first.id);
    expect(again.uses).toBe(1);
    expect(await storedRows()).toHaveLength(1);
  });

  it("treats the same text under another kind or another user as a new memory", async () => {
    await remember(env, "alice", { kind: "skill", text: "SQL joins" });
    await remember(env, "alice", { kind: "weakness", text: "SQL joins" });
    await remember(env, "bob", { kind: "skill", text: "SQL joins" });
    expect(await storedRows()).toHaveLength(3);
  });

  it("drops the least recently used memory once a person has 200", async () => {
    const now = new Date().toISOString();
    const fill = await Promise.all(
      Array.from({ length: 200 }, async (_, i) => {
        const sealed = await encryptFor(env.MEMORY_SECRET, "alice", `memory ${i}`);
        const lastUsed = i === 7 ? daysAgo(20) : now;
        return env.DB.prepare(
          "INSERT INTO user_memories (id, user_id, kind, ciphertext, iv, created_at, last_used_at, uses) VALUES (?, 'alice', 'note', ?, ?, ?, ?, 0)",
        ).bind(`m${i}`, sealed.ciphertext, sealed.iv, now, lastUsed);
      }),
    );
    await env.DB.batch(fill);

    await remember(env, "alice", { kind: "goal", text: "one more" });

    const ids = (await listMemories(env, "alice")).map((m) => m.id);
    expect(ids).toHaveLength(200);
    expect(ids).not.toContain("m7");
  });
});

describe("recall", () => {
  it("ranks memories by overlap with the query", async () => {
    await remember(env, "alice", { kind: "weakness", text: "Rambles when explaining system design" });
    await remember(env, "alice", { kind: "goal", text: "Work at a climate startup" });
    await remember(env, "alice", { kind: "skill", text: "Comfortable with React" });

    const [top] = await recall(env, "alice", { query: "practice system design questions" });
    expect(top.text).toBe("Rambles when explaining system design");
  });

  it("prefers the more recently used memory when the query doesn't decide", async () => {
    const old = await remember(env, "alice", { kind: "note", text: "Old note" });
    const fresh = await remember(env, "alice", { kind: "note", text: "Fresh note" });
    await setLastUsed(old.id, daysAgo(10));
    await setLastUsed(fresh.id, daysAgo(1));

    const results = await recall(env, "alice");
    expect(results.map((m) => m.id)).toEqual([fresh.id, old.id]);
  });

  it("filters by kind and respects the limit", async () => {
    for (let i = 0; i < 5; i++) await remember(env, "alice", { kind: "skill", text: `skill ${i}` });
    await remember(env, "alice", { kind: "goal", text: "a goal" });

    const skills = await recall(env, "alice", { kinds: ["skill"], limit: 3 });
    expect(skills).toHaveLength(3);
    expect(skills.every((m) => m.kind === "skill")).toBe(true);
  });

  it("returns at most 8 by default", async () => {
    for (let i = 0; i < 10; i++) await remember(env, "alice", { kind: "note", text: `note ${i}` });
    expect(await recall(env, "alice")).toHaveLength(8);
  });

  it("handles a limit larger than D1's bound-parameter cap", async () => {
    const now = new Date().toISOString();
    const fill = await Promise.all(
      Array.from({ length: 150 }, async (_, i) => {
        const sealed = await encryptFor(env.MEMORY_SECRET, "alice", `memory ${i}`);
        return env.DB.prepare(
          "INSERT INTO user_memories (id, user_id, kind, ciphertext, iv, created_at, last_used_at, uses) VALUES (?, 'alice', 'note', ?, ?, ?, ?, 0)",
        ).bind(`m${i}`, sealed.ciphertext, sealed.iv, now, now);
      }),
    );
    await env.DB.batch(fill);

    expect(await recall(env, "alice", { limit: 150 })).toHaveLength(150);
  });

  it("marks what it returned as used", async () => {
    const memory = await remember(env, "alice", { kind: "goal", text: "Ship a portfolio" });
    await setLastUsed(memory.id, daysAgo(5));

    const [recalled] = await recall(env, "alice");
    expect(recalled.uses).toBe(1);

    const row = await env.DB.prepare("SELECT uses, last_used_at FROM user_memories WHERE id = ?").bind(memory.id).first<{ uses: number; last_used_at: string }>();
    expect(row?.uses).toBe(1);
    expect(row!.last_used_at > daysAgo(1)).toBe(true);
  });
});

describe("privacy between people", () => {
  it("never lets one person recall, list or forget another person's memories", async () => {
    const secret = await remember(env, "alice", { kind: "weakness", text: "Nervous about salary talks" });

    expect(await recall(env, "bob", { query: "nervous salary talks" })).toEqual([]);
    expect(await listMemories(env, "bob")).toEqual([]);
    expect(await forget(env, "bob", secret.id)).toBe(false);

    expect(await listMemories(env, "alice")).toHaveLength(1);
  });
});

describe("forget", () => {
  it("deletes the memory and reports whether it existed", async () => {
    const memory = await remember(env, "alice", { kind: "note", text: "temporary" });
    expect(await forget(env, "alice", memory.id)).toBe(true);
    expect(await forget(env, "alice", memory.id)).toBe(false);
    expect(await listMemories(env, "alice")).toEqual([]);
  });
});
