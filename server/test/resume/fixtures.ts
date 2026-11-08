import type { Resume } from "../../src/resume/types";

export const sampleResume: Resume = {
  contact: { name: "Jordan Lee", email: "jordan@example.com", phone: "403-555-0100", location: "Calgary, AB", links: ["github.com/jordanlee"] },
  summary: "Third-year computer science student",
  experience: [
    {
      role: "Software Developer Co-op",
      org: "ATB Financial",
      start: "May 2026",
      end: "Aug 2026",
      bullets: ["Worked on a Python Flask API", "Wrote SQL reports in Postgres for the lending team"],
    },
  ],
  education: [{ school: "University of Calgary", program: "BSc Computer Science", year: "April 2028" }],
  projects: [{ name: "Budget tracker", bullets: ["Built a budgeting app with SwiftUI"], link: "" }],
  skills: ["Python", "SQL", "SwiftUI"],
};

// what LinkedIn's "Save to PDF" reads as, contact block included
export const linkedinPdfText = [
  "Contact",
  "jordan.lee@example.com",
  "(403) 555-0199",
  "www.linkedin.com/in/jordan-lee-123 (LinkedIn)",
  "github.com/jordanlee (Portfolio)",
  "Top Skills",
  "Python",
  "Excel",
  "Jordan Lee",
  "Student at University of Calgary",
  "Summary",
  "I like computers and want a job in tech.",
  "Experience",
  "Calgary Co-op",
  "Cashier",
  "Helped customers at the till.",
  "See https://jordan.dev for more.",
].join("\n");
