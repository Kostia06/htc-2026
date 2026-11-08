import type { Database } from "./types";

// D1 already has the shape our code relies on; the adapter exists only so both backends share one type
export const d1Database = (d1: D1Database): Database => d1;
