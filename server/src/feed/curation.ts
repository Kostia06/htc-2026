import { type CuratedItem, curatedItems } from "./curated";
import type { Enrichment } from "./enrich";
import type { Candidate } from "./types";

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// a dated item is dropped the day after it starts; undated ones (ongoing, annual) always stay in the pool.
// What its own page said, when already read, rides along on the card and into the text the ranker matches
export function curatedCandidates(now: Date, enrichments: ReadonlyMap<string, Enrichment | null> = new Map(), items: CuratedItem[] = curatedItems): Candidate[] {
  return items.flatMap((item) => {
    const dated = ISO_DAY.test(item.when);
    if (dated && Date.parse(item.when) < now.getTime() - DAY_MS) return [];
    const learned = enrichments.get(item.url) ?? undefined;
    return [
      {
        card: {
          id: item.id,
          kind: item.kind,
          title: item.title,
          org: item.org,
          when: item.when,
          where: item.where,
          url: item.url,
          source: "Curated",
          tags: item.tags,
          ...(learned && {
            summary: learned.summary,
            ...(learned.level && { level: learned.level }),
            ...(learned.format && { format: learned.format }),
            ...(learned.highlights.length > 0 && { highlights: learned.highlights }),
          }),
        },
        text: [item.title, item.org, item.tags.join(", "), learned?.summary, ...(learned?.highlights ?? [])].filter(Boolean).join("\n"),
        fields: item.fields,
        ...(dated && { startsAt: item.when }),
      },
    ];
  });
}
