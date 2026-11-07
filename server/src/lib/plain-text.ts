const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'", "#x2F": "/", nbsp: " " };

// API excerpts arrive as HTML; the model only needs the words
export function plainText(html: string, maxLength: number) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#?\w+);/g, (match, name: string) => ENTITIES[name] ?? match)
    .replace(/\s+/g, " ")
    .replace(/ ([.,;:!?])/g, "$1")
    .trim()
    .slice(0, maxLength);
}
