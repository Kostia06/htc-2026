import { curatedItems } from "./curated";
import type { Candidate } from "./types";

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// a dated item is dropped the day after it starts; undated ones (ongoing, annual) always stay in the pool
export function curatedCandidates(now: Date): Candidate[] {
  return curatedItems.flatMap((item) => {
    const dated = ISO_DAY.test(item.when);
    if (dated && Date.parse(item.when) < now.getTime() - DAY_MS) return [];
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
        },
        text: `${item.title}\n${item.org}\n${item.tags.join(", ")}`,
        fields: item.fields,
        ...(dated && { startsAt: item.when }),
      },
    ];
  });
}
