import type { FeedField, FeedKind } from "../types";

// a real event, hackathon or course that was checked by hand; `when` is an ISO day or the source's own label, such as "ongoing"
export type CuratedItem = {
  id: string;
  kind: Exclude<FeedKind, "job">;
  title: string;
  org: string;
  when: string;
  where: string;
  url: string;
  fields: FeedField[];
  tags: string[];
};
