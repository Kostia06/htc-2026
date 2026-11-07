import { describe, expect, it } from "vitest";
import { scrubStrings } from "../../src/lib/scrub";

describe("scrubStrings", () => {
  it("removes contact details from every string, however deep, and leaves the rest alone", () => {
    const out = scrubStrings({
      summary: "Mail jo@acme.com or call 403-555-0199",
      steps: [{ step: "See linkedin.com/in/jo-smith", why: "plain" }],
      count: 3,
      done: true,
    });
    expect(out).toEqual({
      summary: "Mail [email] or call [phone]",
      steps: [{ step: "See [profile]", why: "plain" }],
      count: 3,
      done: true,
    });
  });
});
