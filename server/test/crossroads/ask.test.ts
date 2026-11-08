import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { crossroadsRouter } from "../../src/api/crossroads";
import { requireSession } from "../../src/auth/session";
import { ensureExploreStep } from "../../src/crossroads/explore-step";
import type { AppContext } from "../../src/env";
import type { GeminiContent } from "../../src/integrations/gemini";
import { remember } from "../../src/memory/private/store";
import { loadAll } from "../../src/roadmap/store";
import { call, fakeDeps } from "../agents/fakes";
import { executionCtx, person, seedCrossroads, useFakeEmbeddings } from "./helpers";

type Answer = { reply: string; needsAnswer: boolean; cites: { type: string; id: string }[]; error?: string };

function askApp(replies: GeminiContent[], hourlyLimit?: number) {
  const app = new Hono<AppContext>();
  app.use("*", requireSession);
  const fakes = fakeDeps({ replies });
  app.route("/", crossroadsRouter(() => fakes.deps, { hourlyLimit }));
  return { app, ...fakes };
}

const ask = (app: Hono<AppContext>, token: string, body: unknown) =>
  app.request("/ask", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }, env, executionCtx);

const finish = (reply: string, cites: string[], needsAnswer = false) => call("finish", { reply, needsAnswer, cites });

describe("POST /api/crossroads/ask", () => {
  beforeEach(async () => {
    useFakeEmbeddings();
    await seedCrossroads();
  });

  it("answers from the person's items and the road, and maps cites back to real ids", async () => {
    const me = await person("Junior data analyst");
    const note = await remember(env, me.id, { kind: "weakness", text: "Froze when asked to write SQL joins without autocomplete" });
    await ensureExploreStep(env, me.id, "Junior data analyst");
    const { app, conversations } = askApp([finish("For example, others on this road practised SQL daily.", ["y1", "e1", "zz9"])]);

    const res = await ask(app, me.token, { message: "Is my SQL thing common?" });
    expect(res.status).toBe(200);
    const answer = await res.json<Answer>();
    expect(answer.reply).toBe("For example, others on this road practised SQL daily.");
    // an invented key is dropped rather than pointing at nothing
    expect(answer.cites).toEqual([
      { type: "you", id: note.id },
      { type: "everyone", id: "ex_data_struggle_1" },
    ]);
    const goal = conversations[0][0].parts[0].text!;
    expect(goal).toContain("y1 [weakness] Froze when asked");
    expect(goal).toContain("example, not a real report");
    expect(goal).toContain("y1 ~ e1");
    expect(goal).not.toContain(note.id);
    expect(goal).not.toContain(me.id);
    const [step] = await loadAll(env, me.id);
    expect(step.status).toBe("done");
  });

  it("asks at most one clarifying question per conversation", async () => {
    const me = await person("Junior data analyst");
    const { app } = askApp([finish("Which role do you mean?", ["y1"], true), finish("Still asking?", [], true)]);
    const first = await (await ask(app, me.token, { message: "what about that one?" })).json<Answer>();
    expect(first).toEqual({ reply: "Which role do you mean?", needsAnswer: true, cites: [] });

    const conversation = [{ speaker: "user", text: "what about that one?" }, { speaker: "raven", text: first.reply }];
    const second = await (await ask(app, me.token, { message: "the analyst one", conversation })).json<Answer>();
    expect(second.needsAnswer).toBe(false);
  });

  it("rejects an empty question and rate limits", async () => {
    const me = await person();
    expect((await ask(askApp([]).app, me.token, { message: "  " })).status).toBe(400);
    expect((await ask(askApp([], 0).app, me.token, { message: "hi" })).status).toBe(429);
  });
});
