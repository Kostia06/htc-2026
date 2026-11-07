import { describe, expect, it } from "vitest";
import { crawlDelaySeconds, isAllowed } from "../../src/lib/robots";

describe("robots", () => {
  it("disallows a path under a Disallow rule", () => {
    expect(isAllowed("User-agent: *\nDisallow: /careers", "HTCMentorBot", "/careers/jobs")).toBe(false);
  });

  it("lets the longer Allow rule win", () => {
    const txt = "User-agent: *\nDisallow: /careers\nAllow: /careers/public";
    expect(isAllowed(txt, "HTCMentorBot", "/careers/public/x")).toBe(true);
  });

  it("uses the group for our agent over the * group", () => {
    const txt = "User-agent: *\nDisallow: /\n\nUser-agent: HTCMentorBot\nDisallow: /private";
    expect(isAllowed(txt, "HTCMentorBot/1.0", "/about")).toBe(true);
  });

  it("supports * and $ in rule paths", () => {
    const txt = "User-agent: *\nDisallow: /*?\nDisallow: /*.pdf$";
    expect(isAllowed(txt, "HTCMentorBot", "/programs?page=2")).toBe(false);
    expect(isAllowed(txt, "HTCMentorBot", "/programs")).toBe(true);
    expect(isAllowed(txt, "HTCMentorBot", "/files/guide.pdf")).toBe(false);
    expect(isAllowed(txt, "HTCMentorBot", "/files/guide.pdf.html")).toBe(true);
  });

  it("allows everything when robots.txt is empty", () => {
    expect(isAllowed("", "HTCMentorBot", "/anything")).toBe(true);
  });

  it("reads Crawl-delay for the group that applies, taking the stricter of ours and *", () => {
    const txt = "User-agent: *\nCrawl-delay: 30\nDisallow: /vote\n\nUser-agent: HTCMentorBot\nCrawl-delay: 5";
    expect(crawlDelaySeconds(txt, "HTCMentorBot/1.0")).toBe(30);
    expect(crawlDelaySeconds("User-agent: *\nCrawl-delay: 5", "OtherBot")).toBe(5);
  });

  it("has no crawl delay when none is set or the value is junk", () => {
    expect(crawlDelaySeconds("User-agent: *\nDisallow: /x", "HTCMentorBot")).toBe(0);
    expect(crawlDelaySeconds("User-agent: *\nCrawl-delay: soon", "HTCMentorBot")).toBe(0);
    expect(crawlDelaySeconds("", "HTCMentorBot")).toBe(0);
  });

  it("keeps a Crawl-delay-only group separate from the next user-agent", () => {
    const txt = "User-agent: *\nCrawl-delay: 10\nUser-agent: OtherBot\nDisallow: /";
    expect(isAllowed(txt, "HTCMentorBot", "/about")).toBe(true);
  });
});
