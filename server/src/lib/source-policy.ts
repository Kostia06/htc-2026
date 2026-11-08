// Which outside sites the agent may read, and how. Keenable's /fetch ignores the target site's
// robots.txt and terms, so this list and our own robots.txt check are what actually decide.

export type SearchUse = "link" | "anecdote" | "drop";

type DeniedSite = { brand: string; why: string; search: SearchUse };

const DENIED: DeniedSite[] = [
  // search snippets are what any search engine shows; the thread itself is never read or stored
  { brand: "reddit", why: "reddit.com disallows all crawling", search: "anecdote" },
  { brand: "redd", why: "reddit.com disallows all crawling", search: "anecdote" },
  { brand: "jointaro", why: "its terms forbid scraping", search: "drop" },
  { brand: "jobbank", why: "its terms forbid automated access; link to postings instead", search: "link" },
  // listings come only through the Adzuna API (job_postings), never their pages
  { brand: "adzuna", why: "Adzuna listings come only through its API", search: "drop" },
  { brand: "glassdoor", why: "login-walled, off limits", search: "drop" },
  { brand: "linkedin", why: "login-walled, off limits", search: "drop" },
  { brand: "indeed", why: "login-walled, off limits", search: "drop" },
];

// brand.tld or brand.tld.cc, any subdomain: matches ca.indeed.com and glassdoor.co.uk, not reddit.com.example.org
const brandPattern = (brand: string) => new RegExp(`(^|\\.)${brand}\\.[a-z]{2,3}(\\.[a-z]{2})?$`);
const RULES = DENIED.map((site) => ({ ...site, pattern: brandPattern(site.brand) }));

function hostOf(url: string) {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

const ruleFor = (host: string) => RULES.find((r) => r.pattern.test(host));

// null means the page may be fetched, subject to its robots.txt
export function fetchBlockReason(url: string): string | null {
  const host = hostOf(url);
  if (!host) return "only public http(s) pages";
  return ruleFor(host)?.why ?? null;
}

export function searchResultUse(url: string): SearchUse {
  const host = hostOf(url);
  if (!host) return "drop";
  return ruleFor(host)?.search ?? "link";
}
