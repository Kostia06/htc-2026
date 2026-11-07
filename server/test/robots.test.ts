import { describe, expect, it } from "vitest";
import { isAllowed, isBlockedHost } from "../src/lib/robots";

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

  it("allows everything when robots.txt is empty", () => {
    expect(isAllowed("", "HTCMentorBot", "/anything")).toBe(true);
  });

  it("blocks login-walled job sites", () => {
    expect(isBlockedHost("https://www.glassdoor.ca/x")).toBe(true);
    expect(isBlockedHost("https://ca.linkedin.com/jobs")).toBe(true);
    expect(isBlockedHost("https://careers.example.com")).toBe(false);
  });
});
