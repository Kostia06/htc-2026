type Rule = { allow: boolean; path: string };
type Group = { agents: string[]; rules: Rule[]; delay?: number };

function groups(txt: string) {
  const out: Group[] = [];
  let current: Group | null = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    const k = key.toLowerCase();
    if (k === "user-agent") {
      if (!current || current.rules.length || current.delay !== undefined) out.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if (current && (k === "allow" || k === "disallow") && value) {
      current.rules.push({ allow: k === "allow", path: value });
    } else if (current && k === "crawl-delay") {
      const seconds = Number(value);
      current.delay = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    }
  }
  return out;
}

const productToken = (userAgent: string) => userAgent.toLowerCase().split("/")[0];

function groupFor(all: Group[], userAgent: string) {
  const ua = productToken(userAgent);
  return all.find((g) => g.agents.some((a) => a !== "*" && ua.startsWith(a))) ?? all.find((g) => g.agents.includes("*"));
}

// RFC 9309: "*" matches any run of characters and a trailing "$" anchors the end
function matches(rulePath: string, path: string) {
  if (!/[*$]/.test(rulePath)) return path.startsWith(rulePath);
  const anchored = rulePath.endsWith("$");
  const body = (anchored ? rulePath.slice(0, -1) : rulePath).split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${body.join(".*")}${anchored ? "$" : ""}`).test(path);
}

export function isAllowed(robotsTxt: string, userAgent: string, path: string) {
  const group = groupFor(groups(robotsTxt), userAgent);
  if (!group) return true;
  let best: Rule | null = null;
  for (const r of group.rules) {
    if (!matches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

// pages are fetched through Keenable on our behalf, so the stricter of our group and * applies
export function crawlDelaySeconds(robotsTxt: string, userAgent: string) {
  const all = groups(robotsTxt);
  const delays = [groupFor(all, userAgent), all.find((g) => g.agents.includes("*"))].map((g) => g?.delay ?? 0);
  return Math.max(...delays);
}
