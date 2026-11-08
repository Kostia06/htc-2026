import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { feedRouter } from "../../src/api/feed";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";
import { actionHistory } from "../../src/feed/actions";
import type { JobPosting, JobQuery } from "../../src/integrations/adzuna";
import { ADZUNA_ATTRIBUTION } from "../../src/integrations/adzuna";
import { updateProfile } from "../../src/memory/profile/store";

const posting = (id: string, title: string): JobPosting => ({
  title,
  company: "Acme",
  location: "Calgary, Alberta",
  posted_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  description: "React and TypeScript",
  url: `https://www.adzuna.ca/details/${id}`,
  ...ADZUNA_ATTRIBUTION,
});

const searchJobs = async (query: JobQuery) => Array.from({ length: 25 }, (_, i) => posting(`${query.what.length}-${i}`, `${query.what} ${i}`));

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.route("/", feedRouter(() => ({ searchJobs })));

type Item = { id: string; kind: string; title: string; why: string; saved?: boolean; tags?: string[] };
type Page = { items: Item[]; nextCursor: string | null; building: boolean; builtAt: string | null; section: string };

function backgroundWork() {
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext;
  return { ctx, settle: () => Promise.all(pending) };
}

async function getFeed(token: string, section?: string, cursor?: string) {
  const query = new URLSearchParams();
  if (section !== undefined) query.set("section", section);
  if (cursor !== undefined) query.set("cursor", cursor);
  const work = backgroundWork();
  const res = await app.request(`/?${query}`, { headers: { Authorization: `Bearer ${token}` } }, env, work.ctx);
  await work.settle();
  return { status: res.status, body: (await res.json()) as Page };
}

async function act(token: string, id: string, action: unknown) {
  const res = await app.request(`/items/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  }, env, backgroundWork().ctx);
  return { status: res.status, body: (await res.json()) as { id?: string; action?: string; error?: string } };
}

// two reads: the first starts the build, the second sees it
async function builtFeed(token: string, section?: string) {
  await getFeed(token, section);
  return getFeed(token, section);
}

async function person(targetRoles: string[], program = "BSc Computer Science") {
  const token = await issueSession(env.SESSION_SECRET);
  const id = (await verifySession(token, env.SESSION_SECRET))!;
  await updateProfile(env, id, { targetRoles, skills: [{ name: "React", source: "self-reported" }], education: [{ school: "UCalgary", program }] });
  return { token, id };
}

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM feed_items"), env.DB.prepare("DELETE FROM feed_state"), env.DB.prepare("DELETE FROM feed_actions")]);
});

describe("GET /api/feed?section=", () => {
  it("serves jobs, events, hackathons and courses in their own sections, each with a why line", async () => {
    const { token } = await person(["Junior developer"]);
    await builtFeed(token);
    for (const [section, kind] of [["jobs", "job"], ["events", "event"], ["hackathons", "hackathon"], ["courses", "course"]] as const) {
      const { body } = await getFeed(token, section);
      expect(body.section).toBe(section);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.every((i) => i.kind === kind && i.why.length > 0)).toBe(true);
    }
  });

  it("mixes kinds in For you and ranks the computer science student's field first among curated items", async () => {
    const { token } = await person(["Junior developer"]);
    const { body } = await builtFeed(token);
    expect(new Set(body.items.map((i) => i.kind)).size).toBeGreaterThan(1);
    const { body: events } = await getFeed(token, "events");
    expect(events.items[0].why).toMatch(/In your field: computer science|Coming up/);
  });

  it("ranks health events first for a nursing student", async () => {
    const { token } = await person(["Registered nurse"], "Bachelor of Nursing");
    await builtFeed(token);
    const { body } = await getFeed(token, "events");
    expect(body.items[0].why).toBe("In your field: health");
  });

  it("rejects a section it doesn't know", async () => {
    const { token } = await person(["Junior developer"]);
    expect((await getFeed(token, "nope")).status).toBe(400);
  });
});

describe("POST /api/feed/items/:id", () => {
  it("keeps saved cards in Saved, newest first, and marks them in the feed", async () => {
    const { token } = await person(["Junior developer"]);
    const { body } = await builtFeed(token);
    const [first, second] = body.items;
    expect(await act(token, first.id, "save")).toEqual({ status: 200, body: { id: first.id, action: "save" } });
    await act(token, second.id, "save");

    const saved = await getFeed(token, "saved");
    expect(saved.body.items.map((i) => i.id)).toEqual([second.id, first.id]);
    expect(saved.body.items.every((i) => i.saved)).toBe(true);
    const main = await getFeed(token);
    expect(main.body.items.find((i) => i.id === first.id)?.saved).toBe(true);
    expect(main.body.items.find((i) => i.id !== first.id && i.id !== second.id)?.saved).toBeUndefined();
  });

  it("hides a dismissed card from every section for good and remembers its tags", async () => {
    const { token, id } = await person(["Junior developer"]);
    const { body } = await builtFeed(token, "events");
    const target = body.items[0];
    expect((await act(token, target.id, "dismiss")).status).toBe(200);

    const now = await getFeed(token, "events");
    expect(now.body.items.map((i) => i.id)).not.toContain(target.id);
    expect(now.body.building).toBe(true);
    const rebuilt = await getFeed(token, "events");
    expect(rebuilt.body.building).toBe(false);
    expect(rebuilt.body.items.map((i) => i.id)).not.toContain(target.id);
    expect((await getFeed(token)).body.items.map((i) => i.id)).not.toContain(target.id);

    const history = await actionHistory(env, id);
    expect([...history.dismissed]).toEqual([target.id]);
    expect(history.avoidTags).toEqual(target.tags);
  });

  it("dismissing a saved card takes it out of Saved", async () => {
    const { token } = await person(["Junior developer"]);
    const { body } = await builtFeed(token);
    await act(token, body.items[0].id, "save");
    await act(token, body.items[0].id, "dismiss");
    expect((await getFeed(token, "saved")).body.items).toEqual([]);
  });

  it("unsaving takes a card out of Saved but leaves it in the feed, and is not a dismissal", async () => {
    const { token, id } = await person(["Junior developer"]);
    const { body } = await builtFeed(token);
    const target = body.items[0];
    await act(token, target.id, "save");
    expect(await act(token, target.id, "unsave")).toEqual({ status: 200, body: { id: target.id, action: "unsave" } });

    expect((await getFeed(token, "saved")).body.items).toEqual([]);
    const main = await getFeed(token);
    expect(main.body.building).toBe(false);
    expect(main.body.items.find((i) => i.id === target.id)?.saved).toBeUndefined();
    const history = await actionHistory(env, id);
    expect([...history.dismissed]).toEqual([]);
    expect(history.avoidTags).toEqual([]);
  });

  it("unsaving is safe to repeat and never brings back a dismissed card", async () => {
    const { token, id } = await person(["Junior developer"]);
    const { body } = await builtFeed(token);
    expect((await act(token, body.items[0].id, "unsave")).status).toBe(200);
    expect((await act(token, "job:never-seen", "unsave")).status).toBe(200);

    await act(token, body.items[1].id, "dismiss");
    await act(token, body.items[1].id, "unsave");
    expect([...(await actionHistory(env, id)).dismissed]).toEqual([body.items[1].id]);
  });

  it("rejects an unknown action and a card that was never in the feed", async () => {
    const { token } = await person(["Junior developer"]);
    const { body } = await builtFeed(token);
    expect((await act(token, body.items[0].id, "like")).status).toBe(400);
    expect((await act(token, "job:nope", "save")).status).toBe(404);
  });
});
