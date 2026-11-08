// The connection store on Postgres: the upsert that resets a re-started sign-in, and the sealed derived data.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectedProviders, deleteConnectionRow, getConnection, saveDerived, setStatus, startConnection } from "../src/connections/store";
import type { Env } from "../src/env";
import { openTestDatabase } from "./pglite";

let db: Awaited<ReturnType<typeof openTestDatabase>>;
let env: Env;

beforeAll(async () => {
  db = await openTestDatabase();
  env = db.env;
});
afterAll(() => db.pg.close());

const derived = { items: [{ name: "budget-bot", topics: [], stars: 1 }], addedProjects: ["budget-bot"], noteIds: ["m1"], suggestions: [] };

describe("user_connections", () => {
  it("keeps each provider's connection apart, and reads an import sealed before connectors were generalised", async () => {
    await startConnection(env, "u3", "github", "ca_g");
    await startConnection(env, "u3", "notion", "ca_n");
    await setStatus(env, "u3", "notion", "active");
    const legacy = { repos: derived.items, addedProjects: [], noteIds: [], suggestions: [] };
    await saveDerived(env, "u3", "github", legacy as unknown as typeof derived);
    expect(await getConnection(env, "u3", "github")).toMatchObject({ status: "pending", derived: { items: derived.items } });
    expect(await getConnection(env, "u3", "notion")).toMatchObject({ accountId: "ca_n", status: "active", derived: undefined });
    expect((await connectedProviders(env, "u3")).sort()).toEqual(["github", "notion"]);
    await deleteConnectionRow(env, "u3", "notion");
    expect(await connectedProviders(env, "u3")).toEqual(["github"]);
  });

  it("starts, activates, seals what was derived, restarts clean and deletes", async () => {
    await startConnection(env, "u1", "github", "ca_1");
    await setStatus(env, "u1", "github", "active");
    await saveDerived(env, "u1", "github", derived);
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
