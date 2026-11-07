import { describe, expect, it } from "vitest";
import { anonymize } from "../../src/lib/anonymize";

describe("anonymize", () => {
  it("removes emails and phone numbers", () => {
    const out = anonymize("mail a.b@x.ca or 403-555-0199", ["Kostia"]);
    expect(out).not.toContain("a.b@x.ca");
    expect(out).not.toContain("555-0199");
    expect(out).toContain("[email]");
    expect(out).toContain("[phone]");
  });

  it("replaces known names case-insensitively as whole words", () => {
    expect(anonymize("Kostia was asked about joins", ["kostia"])).toBe("[name] was asked about joins");
    expect(anonymize("Kostiantyn stays", ["kostia"])).toBe("Kostiantyn stays");
  });

  it("hides personal profile links", () => {
    expect(anonymize("see linkedin.com/in/jane-doe")).toContain("[profile]");
    expect(anonymize("my code: https://github.com/janedoe")).toContain("[profile]");
  });
});
