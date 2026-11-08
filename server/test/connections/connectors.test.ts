import { afterEach, describe, expect, it, vi } from "vitest";
import { WriteToolRefused } from "../../src/connections/read-only";
import { CONNECTORS, connectorFor } from "../../src/connections/registry";
import type { ProviderId } from "../../src/connections/types";
import { executeReadTool } from "../../src/integrations/composio";
import { fakeDeps } from "../agents/fakes";
import { fakeComposio, keyed } from "./fixtures";
import { leakMarkers, listResponses } from "./provider-fixtures";

afterEach(() => vi.restoreAllMocks());

const call = { userId: "skillit_x", accountId: "ca_1", args: {} };
const WRITE_VERBS = /CREATE|UPDATE|DELETE|REMOVE|ADD|SET|PUT|POST|EDIT|MERGE|STAR|FORK|COMMIT|PUSH|TRANSFER|REPLACE|DISPATCH|UPLOAD|SHARE|INSERT|MOVE|COPY|RATE|SUBSCRIBE|EMPTY|TRASH|ARCHIVE|APPEND|INVITE/;
const others = (id: ProviderId) => CONNECTORS.filter((c) => c.id !== id);

describe("every connector is read-only", () => {
  it("offers between five and eight connectors, GitHub among them", () => {
    expect(CONNECTORS.length).toBeGreaterThanOrEqual(5);
    expect(CONNECTORS.length).toBeLessThanOrEqual(8);
    expect(connectorFor("github")).toBeDefined();
    expect(connectorFor("nope")).toBeUndefined();
  });

  describe.each(CONNECTORS.map((c) => [c.id, c] as const))("%s", (_id, connector) => {
    it("allows only reads from its own toolkit", () => {
      expect(connector.readTools.length).toBeGreaterThan(0);
      for (const slug of connector.readTools) {
        expect(slug.startsWith(`${connector.toolkit.toUpperCase()}_`)).toBe(true);
        expect(slug).toMatch(/^[A-Z]+_(GET|LIST|SEARCH)_/);
        expect(slug.slice(connector.toolkit.length + 1)).not.toMatch(WRITE_VERBS);
      }
    });

    it.each(["DELETE_A_THING", "CREATE_A_THING", "UPDATE_PROFILE"])("refuses %s before any request", async (verb) => {
      const { spy } = fakeComposio();
      await expect(executeReadTool(keyed, connector, `${connector.toolkit.toUpperCase()}_${verb}`, call)).rejects.toBeInstanceOf(WriteToolRefused);
      expect(spy).not.toHaveBeenCalled();
    });

    it("refuses another connector's read tools on its connection", async () => {
      const { spy } = fakeComposio();
      for (const other of others(connector.id)) {
        for (const slug of other.readTools) await expect(executeReadTool(keyed, connector, slug, call)).rejects.toBeInstanceOf(WriteToolRefused);
      }
      await expect(executeReadTool(keyed, connector, connector.readTools[0].toLowerCase(), call)).rejects.toBeInstanceOf(WriteToolRefused);
      expect(spy).not.toHaveBeenCalled();
    });

    it("pins its toolkit version on every read", async () => {
      const { calls } = fakeComposio();
      await executeReadTool(keyed, connector, connector.readTools[0], call).catch(() => undefined);
      expect(calls[0].body).toMatchObject({ version: connector.toolkitVersion, connected_account_id: "ca_1" });
      expect(connector.toolkitVersion).toMatch(/^\d{8}_\d{2}$/);
    });
  });
});

describe("imports keep only allowlisted fields", () => {
  const read = (slug: string) => Promise.resolve((listResponses[slug] as { data: unknown }).data);
  const nonGithub = CONNECTORS.filter((c) => c.id !== "github");

  it.each(nonGithub.map((c) => [c.id, c] as const))("%s: no emails, tokens, links or owner ids survive", async (_id, connector) => {
    const { deps } = fakeDeps({ env: keyed });
    const { items, suggestions } = await connector.importItems(read, { deps, userId: "u1" });
    expect(items.length).toBeGreaterThan(0);
    const kept = JSON.stringify({ items, suggestions });
    for (const leak of leakMarkers) expect(kept).not.toContain(leak);
    for (const item of items) {
      for (const key of Object.keys(item)) expect(["name", "summary", "language", "kind", "topics", "stars", "updatedAt"]).toContain(key);
      expect(item.summary?.length ?? 0).toBeLessThanOrEqual(160);
    }
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it("skips private, forked, archived, trashed and non-public work", async () => {
    const { deps } = fakeDeps({ env: keyed });
    const names = async (id: string) => (await connectorFor(id)!.importItems(read, { deps, userId: "u1" })).items.map((i) => i.name);
    expect(await names("gitlab")).toEqual(["thesis-pipeline", "notes"]);
    expect(await names("bitbucket")).toEqual(["inventory-api"]);
    expect(await names("youtube")).toEqual(["How I built a weather station with a Raspberry Pi"]);
    // an untitled file says nothing about the person's work: it becomes a rename tip instead of a project
    expect(await names("googledrive")).toEqual(["Marketing plan for the student fair"]);
    // a title that tries to give the model orders is dropped, not imported
    expect(await names("notion")).toEqual(["Case study: redesigning the campus food app"]);
  });

  it("grounds each summary in the item's own text or metadata, and suggests fixes worked out in code", async () => {
    const { deps } = fakeDeps({ env: keyed });
    const gitlab = await connectorFor("gitlab")!.importItems(read, { deps, userId: "u1" });
    expect(gitlab.items[0].summary).toBe("Data pipeline for my thesis on river flooding, built with Python and Airflow.");
    expect(gitlab.suggestions).toEqual([expect.stringContaining("notes")]);
    const drive = await connectorFor("googledrive")!.importItems(read, { deps, userId: "u1" });
    expect(drive.items[0]).toMatchObject({ kind: "Slides", summary: "Google Slides deck, last edited Oct 2026" });
    expect(drive.suggestions.join(" ")).toContain("Untitled document");
  });

  it("asks only for the person's own, public work", async () => {
    const { calls } = fakeComposio();
    const { deps } = fakeDeps({ env: keyed });
    for (const connector of nonGithub) {
      const reader = (slug: string, args: Record<string, unknown>) => executeReadTool(keyed, connector, slug, { ...call, args });
      await connector.importItems(reader, { deps, userId: "u1" });
    }
    const args = Object.fromEntries(calls.map((c) => [c.url.split("/").pop(), c.body?.arguments]));
    expect(args.GITLAB_GET_PROJECTS).toMatchObject({ owned: true, visibility: "public" });
    expect(args.BITBUCKET_LIST_REPOSITORIES).toMatchObject({ role: "owner" });
    expect(args.YOUTUBE_LIST_CHANNEL_VIDEOS).toMatchObject({ mine: true });
    expect(String((args.GOOGLEDRIVE_LIST_FILES as { q: string }).q)).toContain("'me' in owners");
  });
});
