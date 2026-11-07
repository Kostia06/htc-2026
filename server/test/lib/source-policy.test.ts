import { describe, expect, it } from "vitest";
import { fetchBlockReason, searchResultUse } from "../../src/lib/source-policy";

describe("source policy", () => {
  it.each([
    "https://www.reddit.com/r/cscareerquestions/comments/abc/acme_interview/",
    "https://old.reddit.com/r/calgary/",
    "https://redd.it/abc",
    "https://www.jointaro.com/interviews/acme",
    "https://www.jobbank.gc.ca/jobsearch/jobposting/50616463",
    "https://www.adzuna.ca/details/123",
    "https://adzuna.com/search",
    "https://www.glassdoor.ca/Interview/acme",
    "https://ca.linkedin.com/jobs",
    "https://ca.indeed.com/viewjob?jk=1",
    "not a url",
    "ftp://acme.com/file",
  ])("never fetches %s", (url) => {
    expect(fetchBlockReason(url)).toEqual(expect.any(String));
  });

  it.each(["https://acme.com/careers", "https://medium.com/building-carta/interviews", "https://dev.to/a/b", "https://news.ycombinator.com/item?id=1"])(
    "allows %s to be fetched",
    (url) => {
      expect(fetchBlockReason(url)).toBeNull();
    },
  );

  it("does not mistake a lookalike host for a denied one", () => {
    expect(fetchBlockReason("https://notreddit.com/x")).toBeNull();
    expect(fetchBlockReason("https://reddit.com.example.org/x")).toBeNull();
  });

  it("keeps Reddit search results only as anecdotes", () => {
    expect(searchResultUse("https://www.reddit.com/r/x/comments/1/")).toBe("anecdote");
  });

  it("drops search results from sites we never cite", () => {
    for (const url of ["https://www.glassdoor.com/x", "https://www.linkedin.com/x", "https://indeed.com/x", "https://www.jointaro.com/x"]) {
      expect(searchResultUse(url)).toBe("drop");
    }
  });

  it("keeps Job Bank and ordinary results as plain links", () => {
    expect(searchResultUse("https://www.jobbank.gc.ca/jobsearch/jobposting/1")).toBe("link");
    expect(searchResultUse("https://acme.com/careers")).toBe("link");
  });
});
