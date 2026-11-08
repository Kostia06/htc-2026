import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coachTurn, needsTip } from "../../src/voice/coach/live";
import { researchDeps } from "../../src/voice/coach/research";
import { createSession, findSession, listTurns, addTurn } from "../../src/voice/store";
import type { InterviewPlan } from "../../src/voice/types";

const plan: InterviewPlan = { mode: "interview", role: "Junior data analyst", company: "Acme", questions: [] };
const delivery = { words: 14, fillerWords: 0, wordsPerMinute: 120 };
const weak = { scores: { structure: 2, relevance: 2, specificity: 1, confidence: 2 }, delivery, tip: "Add one concrete detail." };
const strong = { scores: { structure: 5, relevance: 5, specificity: 5, confidence: 5 }, delivery, tip: "Keep going." };
const ANSWER = "We kind of worked on a dashboard and I guess it went fine in the end.";
const VALUES_URL = "https://acme.example/careers/values";

const real = { ...researchDeps };
let searches: string[] = [];
let fetched: string[] = [];
let modelCalls = 0;

// the model answers with whatever source the test wants it to cite
function stubModel(sourceUrl: string) {
  vi.stubGlobal("fetch", async () => {
    modelCalls += 1;
    const reply = { rewrite: "I built the dashboard and cut reporting time by [number].", why: "Acme says it hires people who own outcomes.", sourceUrl };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] });
  });
}

beforeEach(() => {
  searches = [];
  fetched = [];
  modelCalls = 0;
  researchDeps.search = async (_env, query) => {
    searches.push(query);
    return [
      { title: "Glassdoor reviews", url: "https://www.glassdoor.com/acme", snippet: "" },
      { title: "Our values", url: VALUES_URL, snippet: "" },
      { title: "Blocked by robots", url: "https://blocked.example/page", snippet: "" },
    ];
  };
  researchDeps.fetchPage = async (_env, url) => {
    fetched.push(url);
    return "We hire people who own outcomes and can say what changed because of them.";
  };
  researchDeps.refusal = async (_env, url) => (url.includes("blocked") ? "robots.txt disallows" : null);
});
afterEach(() => {
  Object.assign(researchDeps, real);
  vi.unstubAllGlobals();
});

async function weakTurn(companySlug: string | null = "acme") {
  const id = await createSession(env, "owner", { mode: "interview", companySlug, plan: companySlug ? plan : { ...plan, company: null } });
  const session = (await findSession(env, "owner", id))!;
  const turn = { question: "Tell me about a time you made an impact.", answer: ANSWER, score: weak };
  const idx = await addTurn(env, "owner", id, { ...turn, timing: { answerStartSec: 30, atSec: 41 } });
  return { session, idx, turn };
}

describe("live research tips", () => {
  it("only coaches a weak score on a real answer", () => {
    expect(needsTip({ question: "q", answer: ANSWER, score: weak })).toBe(true);
    expect(needsTip({ question: "q", answer: ANSWER, score: strong })).toBe(false);
    expect(needsTip({ question: "q", answer: "I don't know.", score: weak })).toBe(false);
  });

  it("cites a page it actually fetched, never a denied or robots-refused one", async () => {
    stubModel(VALUES_URL);
    const { session, idx, turn } = await weakTurn();
    await coachTurn(env, "owner", session, idx, turn);

    expect(fetched).toEqual([VALUES_URL]);
    expect(searches.length).toBeLessThanOrEqual(4);
    expect(modelCalls).toBe(1);
    const [stored] = await listTurns(env, "owner", session.id);
    expect(stored).toMatchObject({ answerStartSec: 30, atSec: 41 });
    expect(stored.liveTip).toMatchObject({ kind: "researched", sources: [{ title: "Our values", url: VALUES_URL }] });
  });

  it("calls it a coaching tip, with no sources, when the model cites a page we never read", async () => {
    stubModel("https://made-up.example/acme-secrets");
    const { session, idx, turn } = await weakTurn();
    await coachTurn(env, "owner", session, idx, turn);
    const [stored] = await listTurns(env, "owner", session.id);
    expect(stored.liveTip).toMatchObject({ kind: "coaching", sources: [] });
  });

  it("spends one tip per session and reuses the research for the next person asking the same", async () => {
    stubModel(VALUES_URL);
    const first = await weakTurn();
    await coachTurn(env, "owner", first.session, first.idx, first.turn);
    await coachTurn(env, "owner", first.session, first.idx, first.turn);
    expect(modelCalls).toBe(1);
    const searchesSoFar = searches.length;

    const second = await weakTurn();
    await coachTurn(env, "owner", second.session, second.idx, second.turn);
    expect(searches.length).toBe(searchesSoFar);
    expect(modelCalls).toBe(2);
  });

  it("skips research with no company and still writes a coaching tip", async () => {
    stubModel("");
    const { session, idx, turn } = await weakTurn(null);
    await coachTurn(env, "owner", session, idx, turn);
    expect(searches).toEqual([]);
    const [stored] = await listTurns(env, "owner", session.id);
    expect(stored.liveTip?.kind).toBe("coaching");
  });
});
