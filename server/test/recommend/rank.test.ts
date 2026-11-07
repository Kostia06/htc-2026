import { describe, expect, it } from "vitest";
import { rankByGoals } from "../../src/recommend/rank";
import type { Level } from "../../src/recommend/types";

const item = (title: string, level: Level) => ({ title, level });

describe("rankByGoals", () => {
  it("case 8: a dream role moves up within its level but stays long term", () => {
    const items = [item("Junior Data Analyst", "stretch"), item("Support Engineer", "long_term"), item("Senior Data Engineer at Shopify", "long_term")];
    const ranked = rankByGoals(items, ["My dream is to be a senior data engineer at Shopify"]);
    expect(ranked).toEqual([item("Junior Data Analyst", "stretch"), item("Senior Data Engineer at Shopify", "long_term"), item("Support Engineer", "long_term")]);
  });

  it("orders by level first so long-term goals never top the apply list", () => {
    const ranked = rankByGoals([item("Data Engineer", "long_term"), item("Barista", "ready_now")], ["data engineer"]);
    expect(ranked.map((i) => i.level)).toEqual(["ready_now", "long_term"]);
  });

  it("keeps the original order when goals say nothing", () => {
    const items = [item("B", "stretch"), item("A", "stretch")];
    expect(rankByGoals(items, [])).toEqual(items);
  });
});
