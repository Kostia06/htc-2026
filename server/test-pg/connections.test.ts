// The connection store on Postgres: the upsert that resets a re-started sign-in, and the sealed derived data.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteConnectionRow, getConnection, saveDerived, setStatus, startConnection } from "../src/connections/store";
import type { Env } from "../src/env";
import { openTestDatabase } from "./pglite";

let db: Awaited<ReturnType<typeof openTestDatabase>>;
let env: Env;

beforeAll(async () => {
  db = await openTestDatabase();
  env = db.env;
});
afterAll(() => db.pg.close());

const derived = { repos: [{ name: "budget-bot", topics: [], stars: 1 }], addedProjects: ["budget-bot"], noteIds: ["m1"], suggestions: [] };

describe("user_connections", () => {
  it("starts, activates, seals what was derived, restarts clean and deletes", async () => {
    await startConnection(env, "u1", "github", "ca_1");
    await setStatus(env, "u1", "github", "active");
    await saveDerived(env, "u1", derived);
    expect(await getConnection(env, "u1", "github")).toMatchObject({ accountId: "ca_1", status: "active", derived, importedAt: expect.any(String) });
    const raw = await db.pg.query<{ ciphertext: string }>("SELECT ciphertext FROM user_connections WHERE user_id = 'u1'");
    expect(raw.rows[0].ciphertext).not.toContain("budget-bot");

    await startConnection(env, "u1", "github", "ca_2");
    expect(await getConnection(env, "u1", "github")).toEqual({ accountId: "ca_2", status: "pending", importedAt: undefined, derived: undefined });
    expect(await getConnection(env, "u2", "github")).toBeNull();

    await deleteConnectionRow(env, "u1", "github");
    expect(await getConnection(env, "u1", "github")).toBeNull();
  });
});
