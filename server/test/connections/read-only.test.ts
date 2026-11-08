import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { github } from "../../src/connections/github/connector";
import { READ_ONLY_GITHUB_TOOLS } from "../../src/connections/github/read-only";
import { WriteToolRefused } from "../../src/connections/read-only";
import { executeReadTool, ComposioNotConfigured } from "../../src/integrations/composio";
import { fakeComposio, keyed } from "./fixtures";

afterEach(() => vi.restoreAllMocks());

const call = { userId: "skillit_x", accountId: "ca_1", args: {} };

describe("GitHub through Composio is read-only", () => {
  it("allows only reads", () => {
    for (const slug of READ_ONLY_GITHUB_TOOLS) {
      expect(slug).toMatch(/^GITHUB_(GET|LIST)_/);
      expect(slug).not.toMatch(/CREATE|UPDATE|DELETE|REMOVE|ADD|SET|PUT|POST|EDIT|MERGE|STAR|FORK|COMMIT|PUSH|TRANSFER|REPLACE|DISPATCH/);
    }
  });

  it.each(["GITHUB_CREATE_AN_ISSUE", "GITHUB_DELETE_A_REPOSITORY", "GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS", "GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER", "GITHUB_GET_A_REPOSITORY_SECRET", "GITHUB_LIST_EMAIL_ADDRESSES_FOR_THE_AUTHENTICATED_USER", "github_list_repositories_for_the_authenticated_user"])(
    "refuses %s before any request is made",
    async (slug) => {
      const { spy } = fakeComposio();
      await expect(executeReadTool(keyed, github, slug, call)).rejects.toBeInstanceOf(WriteToolRefused);
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it("runs an allowlisted read for one connection, pinned to a toolkit version, with the key only in the header", async () => {
    const { calls, spy } = fakeComposio();
    await executeReadTool(keyed, github, "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", { ...call, args: { per_page: 30 } });
    expect(calls[0].url).toBe("https://backend.composio.dev/api/v3.1/tools/execute/GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER");
    expect(calls[0].body).toEqual({ user_id: "skillit_x", connected_account_id: "ca_1", version: expect.stringMatching(/^\d{8}_\d{2}$/), arguments: { per_page: 30 } });
    const headers = new Headers(spy.mock.calls[0][1]?.headers);
    expect(headers.get("x-api-key")).toBe("test-composio-key");
    expect(JSON.stringify(calls[0].body)).not.toContain("test-composio-key");
  });

  it("reports not configured without the key, and calls nobody", async () => {
    const { spy } = fakeComposio();
    await expect(executeReadTool(env, github, "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", call)).rejects.toBeInstanceOf(ComposioNotConfigured);
    expect(spy).not.toHaveBeenCalled();
  });
});
