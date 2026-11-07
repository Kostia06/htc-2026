const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
    const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
  });
}

function tidyLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function htmlToText(html: string) {
  const body = html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return tidyLines(decodeEntities(body));
}

// Word, OpenDocument and PowerPoint all keep text in XML runs; paragraph ends become new lines
export function officeXmlToText(xml: string) {
  const body = xml
    .replace(/<(w:br|text:line-break|a:br)[^>]*\/?>/g, "\n")
    .replace(/<(w:tab|text:tab)[^>]*\/?>/g, " ")
    .replace(/<\/(w:p|text:p|text:h|a:p)>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return tidyLines(decodeEntities(body));
}

export function rtfToText(rtf: string) {
  const body = rtf
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\(par|line)\b ?/g, "\n")
    .replace(/\\tab\b ?/g, " ")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/\\([{}\\])/g, "$1")
    .replace(/[{}]/g, "");
  return tidyLines(body);
}
