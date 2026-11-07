import { describe, expect, it } from "vitest";
import { decryptFor, encryptFor } from "../../../src/memory/private/crypto";

const SECRET = "test-memory-secret";

describe("per-user encryption", () => {
  it("decrypts what it encrypted for the same user", async () => {
    const sealed = await encryptFor(SECRET, "alice", "I freeze up on system design questions");
    expect(await decryptFor(SECRET, "alice", sealed)).toBe("I freeze up on system design questions");
  });

  it("refuses to decrypt with another user's key", async () => {
    const sealed = await encryptFor(SECRET, "alice", "private goal");
    await expect(decryptFor(SECRET, "bob", sealed)).rejects.toThrow();
  });

  it("never leaves the plaintext readable in the ciphertext", async () => {
    const text = "wants a backend job at Acme";
    const sealed = await encryptFor(SECRET, "alice", text);
    expect(sealed.ciphertext).not.toContain(text);
    expect(atob(sealed.ciphertext)).not.toContain(text);
  });

  it("uses a fresh iv every time", async () => {
    const first = await encryptFor(SECRET, "alice", "same text");
    const second = await encryptFor(SECRET, "alice", "same text");
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });
});
