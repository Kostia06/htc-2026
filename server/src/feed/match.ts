export const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9+#]+/g) ?? [];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// a posting for "Data Analyst" is what someone wanting "Junior data analyst" is after; the level is ranked on separately
const SENIORITY = new Set(["junior", "jr", "senior", "sr", "entry", "level", "intern", "associate", "trainee"]);

function roleWords(role: string) {
  const words = wordsOf(role).filter((w) => w.length > 2);
  const core = words.filter((w) => !SENIORITY.has(w));
  return core.length > 0 ? core : words;
}

// every meaningful word of the role appears in the title: "Junior developer" fits "Junior Software Developer"
export function matchingRole(title: string, roles: string[]) {
  const titleWords = new Set(wordsOf(title));
  return roles.find((role) => {
    const words = roleWords(role);
    return words.length > 0 && words.every((w) => titleWords.has(w));
  });
}

// whole words only, so "Java" doesn't match "JavaScript"; "+" and "#" count as word characters for C++ and C#
export const mentions = (text: string, term: string) => new RegExp(`(^|[^a-z0-9+#])${escape(term.toLowerCase())}($|[^a-z0-9+#])`).test(text.toLowerCase());
