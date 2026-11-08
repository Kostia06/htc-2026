// Example road lines Skillit wrote so a new road isn't empty. They are flagged is_seeded and never counted as people.
// Realistic but generic: no real person, no real quote. Self-contained so scripts/seed-crossroads.mjs can import it.
export type SeedLine = { lane: string; kind: "struggle" | "tip" | "interview" | "win"; text: string };

export const techLines: SeedLine[] = [
  { lane: "software", kind: "struggle", text: "Sent 60+ applications with a class-project-only resume and heard almost nothing back." },
  { lane: "software", kind: "struggle", text: "Froze on live coding even though I could solve the same problem alone at home." },
  { lane: "software", kind: "struggle", text: "Didn't know how to explain a group project when I only built one part of it." },
  { lane: "software", kind: "struggle", text: "Kept learning new frameworks instead of finishing one project end to end." },
  { lane: "software", kind: "tip", text: "One deployed project with real users beat three tutorial clones in every interview." },
  { lane: "software", kind: "tip", text: "Talking out loud while coding mattered more than getting the optimal solution." },
  { lane: "software", kind: "tip", text: "Local meetups led to referrals; referrals got replies when cold applications didn't." },
  { lane: "software", kind: "tip", text: "Writing a short README with screenshots made reviewers actually open the repo." },
  { lane: "software", kind: "interview", text: "Walk me through a bug you spent a long time on and how you finally found it." },
  { lane: "software", kind: "interview", text: "Take-home: build a small API with tests in a weekend, then explain trade-offs on a call." },
  { lane: "software", kind: "interview", text: "How would you design a simple URL shortener? Mostly a conversation, not a whiteboard test." },
  { lane: "software", kind: "win", text: "A co-op term turned into a return offer after asking for a small project to own." },

  { lane: "data", kind: "struggle", text: "Knew pandas from courses but froze when asked to write SQL joins without autocomplete." },
  { lane: "data", kind: "struggle", text: "Portfolio was all Kaggle datasets; interviewers wanted messy real-world data." },
  { lane: "data", kind: "struggle", text: "Hard to explain what a model's numbers mean to someone who isn't technical." },
  { lane: "data", kind: "struggle", text: "Every posting asked for 2 years of experience, even the junior analyst ones." },
  { lane: "data", kind: "tip", text: "A dashboard built on local open data (city or province) started real conversations." },
  { lane: "data", kind: "tip", text: "Practising SQL window functions every day for two weeks made the technical screen easy." },
  { lane: "data", kind: "tip", text: "Telling the story behind one chart beat showing ten charts." },
  { lane: "data", kind: "tip", text: "Volunteering analysis for a non-profit counted as real experience on the resume." },
  { lane: "data", kind: "interview", text: "Here's a table of orders: write a query for each customer's second purchase." },
  { lane: "data", kind: "interview", text: "A metric dropped 20% overnight. How would you figure out why?" },
  { lane: "data", kind: "interview", text: "Explain a project where the data was wrong and what you did about it." },
  { lane: "data", kind: "win", text: "An internal reporting role was the way in; analytics work followed within a year." },
];
