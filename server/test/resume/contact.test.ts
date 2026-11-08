import { describe, expect, it } from "vitest";
import { contactFromText, fillContact } from "../../src/resume/contact";
import { emptyResume } from "../../src/resume/types";

const RESUME = `Jordan Lee
Calgary, AB | jordan.lee@example.com | (403) 555-0182
linkedin.com/in/jordanlee · https://github.com/jlee

EXPERIENCE
Software Intern, Acme Corp`;

describe("contactFromText", () => {
  it("finds name, email, phone and links at the top of a resume", () => {
    expect(contactFromText(RESUME)).toEqual({
      name: "Jordan Lee",
      email: "jordan.lee@example.com",
      phone: "(403) 555-0182",
      links: ["linkedin.com/in/jordanlee", "https://github.com/jlee"],
    });
  });

  it("doesn't take a heading or a sentence for a name", () => {
    expect(contactFromText("RESUME\nI am a student looking for work.\njo@x.io").name).toBeUndefined();
    expect(contactFromText("Official Transcript\nUniversity of Calgary").name).toBeUndefined();
  });
});

describe("fillContact", () => {
  it("fills only the blanks and keeps what the person typed", () => {
    const typed = { ...emptyResume().contact, name: "J. Lee" };
    expect(fillContact(typed, { name: "Jordan Lee", email: "j@x.io", links: ["github.com/j"] })).toEqual({
      ...typed,
      email: "j@x.io",
      links: ["github.com/j"],
    });
  });

  it("returns null when nothing new was found", () => {
    const typed = { ...emptyResume().contact, name: "Jordan Lee", email: "j@x.io" };
    expect(fillContact(typed, { name: "Someone Else", email: "other@x.io" })).toBeNull();
  });
});
