import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { CuratedItem } from "../../src/feed/curated";
import { curatedCandidates } from "../../src/feed/curation";
import { cachedEnrichments, type EnrichDeps, type Enrichment, enrichCuratedItems, enrichmentKey, normalizeEnrichment } from "../../src/feed/enrich";

const NOW = new Date("2026-11-07T12:00:00Z");
const DAY_MS = 86_400_000;

const item = (n: number): CuratedItem => ({
  id: `hackathon:h${n}`,
  kind: "hackathon",
  title: `Hack ${n}`,
  org: "Org",
  when: "2026-12-01",
  where: "Calgary, AB",
  url: `https://example.org/hack-${n}`,
  fields: ["cs"],
  tags: ["hackathon"],
});

const extracted = { summary: "A weekend hackathon for students.", level: "beginner", format: "48-hour, in person", highlights: ["$5,000 in prizes"] };

// a fake page reader and model that count their calls
function fakes(overrides: Partial<EnrichDeps> = {}) {
  const calls = { pages: [] as string[], extracts: 0 };
  const deps: EnrichDeps = {
    readPage: async (url) => (calls.pages.push(url), `<h1>Hack</h1> details`),
    extract: async () => (calls.extracts++, extracted),
    ...overrides,
  };
  return { deps, calls };
}

describe("enriching curated items from their own pages", () => {
  it("reads each uncached page once, keeps the result for seven days and leaves cached items alone", async () => {
    const { deps, calls } = fakes();
    expect(await enrichCuratedItems(env, deps, [item(1), item(2)], NOW)).toBe(2);
    expect(calls.pages).toEqual(["https://example.org/hack-1", "https://example.org/hack-2"]);

    expect(await enrichCuratedItems(env, deps, [item(1), item(2)], NOW)).toBe(0);
    expect(calls.extracts).toBe(2);

    const known = await cachedEnrichments(env, NOW);
    expect(known.get("https://example.org/hack-1")).toEqual(extracted);
    const row = await env.DB.prepare("SELECT expires_at FROM cache WHERE key = ?").bind(enrichmentKey("https://example.org/hack-1")).first<{ expires_at: string }>();
    expect(Date.parse(row?.expires_at ?? "") - NOW.getTime()).toBe(7 * DAY_MS);
  });

  it("caps one run at ten items and picks up the rest next time", async () => {
    const items = Array.from({ length: 13 }, (_, i) => item(i));
    const { deps, calls } = fakes();
    expect(await enrichCuratedItems(env, deps, items, NOW)).toBe(10);
    expect(calls.extracts).toBe(10);
    expect(await enrichCuratedItems(env, deps, items, NOW)).toBe(3);
  });

  it("remembers a page it may not read so robots.txt is not asked again for a week, and never calls the model for it", async () => {
    const { deps, calls } = fakes({ readPage: async () => null });
    await enrichCuratedItems(env, deps, [item(1)], NOW);
    await enrichCuratedItems(env, deps, [item(1)], NOW);
    expect(calls.extracts).toBe(0);
    expect((await cachedEnrichments(env, NOW)).get("https://example.org/hack-1")).toBeNull();
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM cache").first<{ n: number }>()).toEqual({ n: 1 });
  });

  it("skips a failed fetch or model call silently without caching, so the next run retries it", async () => {
    let attempts = 0;
    const flaky = fakes({
      readPage: async () => {
        attempts++;
        if (attempts === 1) throw new Error("HTTP 502");
        return "page";
      },
    });
    expect(await enrichCuratedItems(env, flaky.deps, [item(1)], NOW)).toBe(0);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM cache").first<{ n: number }>()).toEqual({ n: 0 });
    expect(await enrichCuratedItems(env, flaky.deps, [item(1)], NOW)).toBe(1);

    const garbage = fakes({ extract: async () => "not json we can use" });
    expect(await enrichCuratedItems(env, garbage.deps, [item(2)], NOW)).toBe(0);
    expect((await cachedEnrichments(env, NOW)).has("https://example.org/hack-2")).toBe(false);
  });

  it("keeps only what the schema allows: two sentences, a known level, three short highlights", () => {
    const loose = {
      summary: "First sentence. Second sentence! Third sentence that should go.",
      level: "unknown",
      format: "",
      highlights: ["  Free to enter ", "Prizes", "Food", "Swag"],
    };
    expect(normalizeEnrichment(loose)).toEqual<Enrichment>({ summary: "First sentence. Second sentence!", level: null, format: null, highlights: ["Free to enter", "Prizes", "Food"] });
    expect(normalizeEnrichment({ summary: "", level: "beginner", format: null, highlights: [] })).toBeNull();
    expect(normalizeEnrichment({ summary: "Fine.", level: "expert", format: 42, highlights: "none" })).toEqual<Enrichment>({ summary: "Fine.", level: null, format: null, highlights: [] });
    expect(normalizeEnrichment(null)).toBeNull();
  });

  it("puts what was learned on the card and into the text the ranker matches", () => {
    const enrichments = new Map<string, Enrichment | null>([["https://example.org/hack-1", { ...extracted, level: "beginner" }], ["https://example.org/hack-2", null]]);
    const [first, second] = curatedCandidates(NOW, enrichments, [item(1), item(2)]);
    expect(first.card).toMatchObject({ summary: extracted.summary, level: "beginner", format: "48-hour, in person", highlights: ["$5,000 in prizes"] });
    expect(first.text).toContain("weekend hackathon for students");
    expect(second.card.summary).toBeUndefined();
    expect("level" in second.card).toBe(false);
  });
});
