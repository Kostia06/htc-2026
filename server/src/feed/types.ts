export type FeedKind = "job" | "hackathon" | "course" | "event";

export const FEED_SECTIONS = ["all", "jobs", "events", "hackathons", "courses", "saved"] as const;
export type FeedSection = (typeof FEED_SECTIONS)[number];
// the sections the builder ranks; "saved" is read from what the person kept instead
export type RankedSection = Exclude<FeedSection, "saved">;

// the broad area a person is heading into; curated items are tagged with the fields they suit
export const FEED_FIELDS = ["cs", "business", "design", "health", "general"] as const;
export type FeedField = (typeof FEED_FIELDS)[number];

export const FEED_ACTIONS = ["save", "dismiss"] as const;
export type FeedAction = (typeof FEED_ACTIONS)[number];

export type Attribution = { label: string; url: string };

export type FeedCard = {
  id: string;
  kind: FeedKind;
  title: string;
  org: string;
  // ISO 8601 when the source gives a date, otherwise a short label as the source states it, such as "ongoing"
  when?: string;
  where?: string;
  // one short line saying why this person is seeing it, built from their profile, never by a model
  why: string;
  // up to three such lines, the best first; `why` is the first of them, or a note about the item itself when none fit
  reasons: string[];
  // the listing's own short description, shown in the app before anyone is sent off-site
  summary?: string;
  // what the source's own page says about who it is for and how it runs; absent until the page has been read
  level?: string;
  format?: string;
  highlights?: string[];
  salary?: string;
  url: string;
  source: string;
  attribution?: Attribution;
  // what dismissing this card steers the ranking away from
  tags?: string[];
  saved?: boolean;
};

// a project or past role of the person's: a label for the reason line plus the words an item can overlap with
export type PastWork = { label: string; words: string[] };

// what the feed is ranked against; only these few profile fields leave the encrypted profile row
export type FeedCriteria = {
  roles: string[];
  skills: string[];
  location?: string;
  fields?: FeedField[];
  avoidTags?: string[];
  work?: PastWork[];
  // studying, between school and a first role, or saying so in their goals
  earlyCareer?: boolean;
  // the profile names AI tools or machine learning anywhere
  usesAI?: boolean;
};

// a card before ranking: the text the ranker matches against plus when it was posted or when it happens
export type Candidate = { card: Omit<FeedCard, "why" | "reasons">; text: string; postedAt?: string; startsAt?: string; fields?: FeedField[] };

export type FeedPage = { items: FeedCard[]; nextCursor: string | null; building: boolean; builtAt: string | null; section: FeedSection };
