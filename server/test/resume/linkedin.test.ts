import { describe, expect, it } from "vitest";
import { linkedinReview } from "../../src/agents/resume/skills/linkedin-review";
import { groundLinkedinSuggestions, maskLinkedinText } from "../../src/resume/linkedin";
import { toolContext } from "../agents/fakes";
import { linkedinPdfText } from "./fixtures";

describe("LinkedIn PDF masking", () => {
  it("strips emails, phones and links before any model sees the text", () => {
    const masked = maskLinkedinText(linkedinPdfText);
    for (const leak of ["jordan.lee@example.com", "555-0199", "linkedin.com/in", "github.com/jordanlee", "https://jordan.dev"]) expect(masked).not.toContain(leak);
    expect(masked).toContain("Student at University of Calgary");
  });

  it("puts only masked text in the goal, wrapped as the person's document", () => {
    const goal = linkedinReview.buildGoal({ text: maskLinkedinText(linkedinPdfText), targetRole: "Data analyst" }, toolContext());
    expect(goal).toContain("Target role: Data analyst");
    expect(goal).toContain("<user-document>");
    expect(goal).not.toContain("@example.com");
  });
});

describe("LinkedIn suggestion grounding", () => {
  const text = maskLinkedinText(linkedinPdfText);

  it("keeps a suggestion only when its quote is really in the PDF", () => {
    const { suggestions, dropped } = groundLinkedinSuggestions(text, {
      suggestions: [
        { area: "headline", quote: "Student at University of Calgary", suggestion: "Computer science student at the University of Calgary aiming for data analyst roles", why: "Says what you want." },
        { area: "about", quote: "I like computers  and want a job in tech", suggestion: "Rewrite the About to name the kind of data work you want.", why: "Too general." },
        { area: "experience", quote: "Led a team of 12 engineers", suggestion: "x", why: "y" },
        { area: "skills", quote: "Python", suggestion: "Add SQL if you've used it; data analyst postings ask for it.", why: "Missing for the role." },
      ],
    });
    expect(suggestions.map((s) => s.area)).toEqual(["headline", "about", "skills"]);
    expect(dropped).toBe(1);
  });

  it("drops an unknown area, an empty suggestion, hype, and anything carrying contact details", () => {
    const { suggestions, dropped } = groundLinkedinSuggestions(text, {
      suggestions: [
        { area: "photo", quote: "Python", suggestion: "Change your photo", why: "x" },
        { area: "skills", quote: "Python", suggestion: "", why: "x" },
        { area: "headline", quote: "Student at University of Calgary", suggestion: "The perfect fit for any data role", why: "x" },
        { area: "about", quote: "Summary", suggestion: "Email recruiters at hr@acme.com", why: "x" },
        { area: "skills", quote: "Top Skills", suggestion: "Add SQL if you've used it.", why: "Data roles ask for it." },
      ],
    });
    expect(suggestions.map((s) => s.suggestion)).toEqual(["Add SQL if you've used it."]);
    expect(dropped).toBe(4);
  });

  it("treats a missing or malformed reply as no suggestions", () => {
    expect(groundLinkedinSuggestions(text, null)).toEqual({ suggestions: [], dropped: 0 });
    expect(groundLinkedinSuggestions(text, { suggestions: "nope" })).toEqual({ suggestions: [], dropped: 0 });
  });
});
