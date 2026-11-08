export type FeedKind = "job" | "hackathon" | "course" | "event";

export type Attribution = { label: string; url: string };

export type FeedCard = {
  id: string;
  kind: FeedKind;
  title: string;
  org: string;
  when?: string;
  where?: string;
  // one short line saying why this person is seeing it, built from their profile, never by a model
  why: string;
  url: string;
  source: string;
  attribution?: Attribution;
};

// what the feed is ranked against; only these few profile fields leave the encrypted profile row
export type FeedCriteria = { roles: string[]; skills: string[]; location?: string };

// a card before ranking: the text the ranker matches against plus when it was posted
export type Candidate = { card: Omit<FeedCard, "why">; text: string; postedAt?: string };

export type FeedPage = { items: FeedCard[]; nextCursor: string | null; building: boolean; builtAt: string | null };
