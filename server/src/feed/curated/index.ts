import { courses } from "./courses";
import { events } from "./events";
import { hackathons } from "./hackathons";
import type { CuratedItem } from "./types";

// bump when items change; every URL in the list was checked to respond on 2026-11-07
export const CURATED_VERSION = 1;

export const curatedItems: CuratedItem[] = [...events, ...hackathons, ...courses];

export type { CuratedItem } from "./types";
