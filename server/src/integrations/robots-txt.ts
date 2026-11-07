// RFC 9309 asks crawlers to parse at least 500 KiB; anything past that is ignored
const MAX_LENGTH = 500_000;

// "" means no robots.txt (everything allowed); null means we couldn't tell, which callers must treat as "no"
export async function fetchRobotsTxt(origin: string, userAgent: string): Promise<string | null> {
  const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": userAgent } }).catch(() => null);
  if (!res) return null;
  if (res.ok) return (await res.text()).slice(0, MAX_LENGTH);
  return res.status === 404 || res.status === 410 ? "" : null;
}
