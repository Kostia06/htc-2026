export const BLOCKED_HOSTS = ["glassdoor.com", "glassdoor.ca", "linkedin.com", "indeed.com"];

export function isBlockedHost(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`));
  } catch {
    return true;
  }
}

type Rule = { allow: boolean; path: string };

function groups(txt: string) {
  const out: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    const k = key.toLowerCase();
    if (k === "user-agent") {
      if (!current || current.rules.length) out.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if (current && (k === "allow" || k === "disallow") && value) {
      current.rules.push({ allow: k === "allow", path: value });
    }
  }
  return out;
}

export function isAllowed(robotsTxt: string, userAgent: string, path: string) {
  const ua = userAgent.toLowerCase().split("/")[0];
  const all = groups(robotsTxt);
  const mine = all.find((g) => g.agents.some((a) => a !== "*" && ua.startsWith(a)));
  const group = mine ?? all.find((g) => g.agents.includes("*"));
  if (!group) return true;
  let best: Rule | null = null;
  for (const r of group.rules) {
    if (!path.startsWith(r.path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}
