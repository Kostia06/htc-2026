import { describe, expect, it } from "vitest";
import { groundProjects, improvementSuggestions } from "../../src/connections/github/ground";
import { MAX_README_CHARS, readmeFrom, redactSecrets, reposFrom, topRepos } from "../../src/connections/github/sanitize";
import { rawRepos, readmeBase64 } from "./fixtures";

describe("GitHub field allowlist", () => {
  it("keeps only the allowlisted fields of the person's own public, active repos", () => {
    const repos = reposFrom({ repositories: rawRepos });
    expect(repos.map((r) => r.name)).toEqual(["budget-bot", "dotfiles"]);
    expect(Object.keys(repos[0]).sort()).toEqual(["description", "language", "name", "owner", "stars", "topics", "updatedAt"]);
    expect(repos[0]).toMatchObject({ language: "Python", stars: 12, topics: ["telegram", "python"], updatedAt: "2026-10-01T10:00:00.000Z" });
    const kept = JSON.stringify(repos);
    for (const leak of ["temp_clone_token", "AAAAsecret", "gho_", "x-access-token", "jordan@example.com", "permissions", "clone_url"]) expect(kept).not.toContain(leak);
  });

  it("finds the repo list whatever key Composio wraps it in, and ignores junk", () => {
    expect(reposFrom({ details: { items: rawRepos } }).length).toBe(2);
    expect(reposFrom(null)).toEqual([]);
    expect(reposFrom({ repositories: [{ name: "../../etc", owner: { login: "x" }, private: false }] })).toEqual([]);
  });

  it("decodes the README and strips secrets, links and contact details before any model sees it", () => {
    const readme = readmeFrom({ content: readmeBase64, encoding: "base64", download_url: "https://raw.githubusercontent.com/x?token=AAAA" });
    expect(readme).toContain("A Telegram bot that tracks shared expenses for roommates");
    for (const leak of ["jordan@example.com", "https://", "ghp_", "ABCdefGhIJKlmnoPQRstuVWxyz", "token=AAAA"]) expect(readme).not.toContain(leak);
    expect(readme).toContain("BOT_TOKEN=[redacted]");
  });

  it("cuts a long README", () => {
    expect(readmeFrom({ content: "word ".repeat(10_000) }).length).toBeLessThanOrEqual(MAX_README_CHARS);
  });

  it.each([
    ["ghp_abcdefghijklmnopqrstuvwxyz012345"],
    ["github_pat_11ABCDEFG0123456789_abcdefghijklmnop"],
    ["sk-proj-abcdefghijklmnop1234567890"],
    ["AKIAIOSFODNN7EXAMPLE"],
    ["eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"],
    ["-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----"],
    ["Authorization: Bearer abc.def.ghijklmnop"],
    ["password = hunter2hunter2"],
  ])("redacts %s", (secret) => {
    const out = redactSecrets(`before ${secret} after`);
    expect(out).toContain("[redacted]");
    expect(out).toContain("before");
  });

  it("orders repos by stars, then by when they were last worked on", () => {
    const repos = reposFrom({ repositories: rawRepos });
    expect(topRepos(repos, 1).map((r) => r.name)).toEqual(["budget-bot"]);
  });
});

describe("GitHub project grounding", () => {
  const repo = { name: "budget-bot", description: "Splits rent between roommates", language: "Python", topics: [], readme: "A Telegram bot written in Python with SQLite." };

  it("keeps a summary its evidence backs, and falls back to the description when it isn't backed", () => {
    const good = groundProjects([repo], { projects: [{ name: "budget-bot", summary: "Telegram bot in Python that splits rent", evidence: "A Telegram bot written in Python" }] });
    expect(good).toEqual({ projects: [{ name: "budget-bot", summary: "Telegram bot in Python that splits rent" }], dropped: 0 });

    const invented = groundProjects([repo], { projects: [{ name: "budget-bot", summary: "Used by 5,000 students", evidence: "A Telegram bot written in Python" }] });
    expect(invented).toEqual({ projects: [{ name: "budget-bot", summary: "Splits rent between roommates" }], dropped: 1 });

    const unquoted = groundProjects([repo], { projects: [{ name: "budget-bot", summary: "A Rust CLI", evidence: "written in Rust for speed" }] });
    expect(unquoted.dropped).toBe(1);
  });

  it("never adds a project the person doesn't have", () => {
    const out = groundProjects([repo], { projects: [{ name: "made-up", summary: "x", evidence: "A Telegram bot written" }] });
    expect(out.projects.map((p) => p.name)).toEqual(["budget-bot"]);
  });

  it("suggests checkable GitHub fixes from what's missing", () => {
    const out = improvementSuggestions([{ ...repo, readme: "" }, { ...repo, name: "b", description: undefined }, { ...repo, name: "c" }]);
    expect(out).toEqual([
      expect.stringContaining("Add a README to budget-bot"),
      expect.stringContaining("Add a one-line description to b"),
      expect.stringContaining("Add a few topics to c"),
    ]);
  });
});
