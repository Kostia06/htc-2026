import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memories } from "../../src/api/memories";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";
import { deps } from "../../src/memory/experiences";
import { listMemories, remember } from "../../src/memory/private/store";

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.route("/", memories);

type Person = { token: string; id: string };

async function newPerson(): Promise<Person> {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, id: (await verifySession(token, env.SESSION_SECRET))! };
}

function call(person: Person, method: string, path: string, body?: unknown) {
  return app.request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${person.token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
}

describe("/api/me/memories", () => {
  let alice: Person;
  let bob: Person;

  beforeEach(async () => {
    vi.spyOn(deps, "scrubNames").mockImplementation(async (_env, fields) => fields);
    vi.spyOn(deps, "upsertVector").mockResolvedValue();
    await env.DB.prepare("INSERT OR IGNORE INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')").run();
    alice = await newPerson();
    bob = await newPerson();
  });

  it("lists only my own memories", async () => {
    await remember(env, alice.id, { kind: "goal", text: "Backend internship" });
    await remember(env, bob.id, { kind: "goal", text: "Design job" });

    const res = await call(alice, "GET", "/");
    expect(res.status).toBe(200);
    const { memories: mine } = await res.json<{ memories: { text: string }[] }>();
    expect(mine.map((m) => m.text)).toEqual(["Backend internship"]);
  });

  it("deletes my memory, and 404s for one that isn't mine", async () => {
    const memory = await remember(env, alice.id, { kind: "note", text: "temporary" });

    expect((await call(bob, "DELETE", `/${memory.id}`)).status).toBe(404);
    expect(await listMemories(env, alice.id)).toHaveLength(1);

    expect((await call(alice, "DELETE", `/${memory.id}`)).status).toBe(204);
    expect(await listMemories(env, alice.id)).toEqual([]);
  });

  it("shares my note as an anonymous experience", async () => {
    const note = await remember(env, alice.id, { kind: "note", text: "They asked me to design a rate limiter" });

    const res = await call(alice, "POST", `/${note.id}/share`, { companySlug: "acme", role: "Backend Intern" });
    expect(res.status).toBe(201);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM experiences").first<{ n: number }>();
    expect(n?.n).toBe(1);
  });

  it("404s when sharing someone else's memory", async () => {
    const note = await remember(env, alice.id, { kind: "note", text: "They asked me to design a rate limiter" });
    expect((await call(bob, "POST", `/${note.id}/share`, { companySlug: "acme", role: "Backend Intern" })).status).toBe(404);
  });

  it("400s on a bad share body or a memory that isn't a note", async () => {
    const note = await remember(env, alice.id, { kind: "note", text: "Asked about Kafka" });
    const goal = await remember(env, alice.id, { kind: "goal", text: "Backend internship" });

    expect((await call(alice, "POST", `/${note.id}/share`, { companySlug: "acme" })).status).toBe(400);
    expect((await call(alice, "POST", `/${note.id}/share`, { companySlug: 7, role: "Intern" })).status).toBe(400);
    expect((await call(alice, "POST", `/${note.id}/share`, { companySlug: "acme", role: "   " })).status).toBe(400);
    expect((await call(alice, "POST", `/${note.id}/share`, "not an object")).status).toBe(400);
    expect((await call(alice, "POST", `/${goal.id}/share`, { companySlug: "acme", role: "Intern" })).status).toBe(400);
  });

  it("rejects requests without a session", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(401);
  });
});
