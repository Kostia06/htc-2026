export type Source = { title: string; url: string };

/**
 * A rewrite of one weak answer, written during the call. "researched" only when it cites a page we actually
 * fetched for this company; anything else is labelled a coaching tip and carries no sources.
 */
export type LiveTip = { kind: "researched" | "coaching"; said: string; rewrite: string; why: string; sources: Source[] };

/** A public page read for this company and role, cut down to what the prompt needs. */
export type ResearchPage = Source & { excerpt: string };
