export type PostingRequirement = {
  text: string;
  /** a 2–5 word name for what it asks, like "React" or "SQL joins"; what a roadmap step is built around */
  topic: string;
  required: boolean;
  /** decided by code against the profile, never by the model */
  have: boolean;
  /** the profile line that proves it, when there is one */
  evidence?: string;
};

export type Prefilled = {
  targetRole: string | null;
  company: { slug: string; name: string; researchQueued: boolean } | null;
  steps: string[];
};

/** What gets encrypted and stored for one posting. */
export type PostingContent = {
  title: string;
  company: string;
  companySlug: string | null;
  location: string | null;
  seniority: string | null;
  requirements: PostingRequirement[];
  responsibilities: string[];
  skills: string[];
  sourceUrl: string | null;
  prefilled: Prefilled;
};

export type Posting = PostingContent & { id: string; createdAt: string };
