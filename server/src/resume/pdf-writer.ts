// A minimal PDF 1.4 writer: one Letter page, the two standard Helvetica fonts, no compression.
// Just enough for a clean text resume, with nothing to install in the Worker.

export type Font = "F1" | "F2"; // regular, bold
export const PAGE = { width: 612, height: 792 } as const;

export type TextOp = { kind: "text"; x: number; y: number; font: Font; size: number; text: string; gray?: number };
export type RuleOp = { kind: "rule"; x: number; y: number; width: number; gray?: number };
export type Op = TextOp | RuleOp;

// Helvetica advance widths per 1000 em, grouped: exact for the common cases, a sensible average for the rest
const NARROW = new Set("ijl.,:;'|!I");
const THIN = new Set("ftr-()[] ");
const WIDE = new Set("mwMW@%");
const CAPS = /[A-Z]/;
const DIGIT = /[0-9]/;

function charWidth(char: string, font: Font) {
  const bold = font === "F2" ? 1.05 : 1;
  if (char === " ") return 278;
  if (NARROW.has(char)) return 260 * bold;
  if (THIN.has(char)) return 333 * bold;
  if (WIDE.has(char)) return 870 * bold;
  if (DIGIT.test(char)) return 556 * bold;
  if (CAPS.test(char)) return 680 * bold;
  return 545 * bold;
}

export function textWidth(text: string, font: Font, size: number) {
  let units = 0;
  for (const char of text) units += charWidth(char, font);
  return (units / 1000) * size;
}

// greedy wrap; a single word longer than the line gets its own line rather than being cut
export function wrap(text: string, font: Font, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, font, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// WinAnsi is what the standard fonts speak; anything outside Latin-1 becomes a plain stand-in rather than a broken glyph
const REPLACEMENTS: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "•": "\\225", "·": "\\267" };

function pdfString(text: string) {
  let out = "";
  for (const char of text.normalize("NFC")) {
    if (REPLACEMENTS[char]) out += REPLACEMENTS[char];
    else if (char === "\\" || char === "(" || char === ")") out += `\\${char}`;
    else if (char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126) out += "?";
    else out += char;
  }
  return `(${out})`;
}

function contentStream(ops: Op[]) {
  const lines: string[] = [];
  for (const op of ops) {
    const gray = (op.gray ?? 0).toFixed(2);
    if (op.kind === "rule") {
      lines.push(`${gray} g ${op.x.toFixed(2)} ${op.y.toFixed(2)} ${op.width.toFixed(2)} 0.6 re f`);
    } else {
      lines.push(`BT ${gray} g /${op.font} ${op.size} Tf 1 0 0 1 ${op.x.toFixed(2)} ${op.y.toFixed(2)} Tm ${pdfString(op.text)} Tj ET`);
    }
  }
  return lines.join("\n");
}

const encoder = new TextEncoder();

export function writePDF(ops: Op[], title: string): Uint8Array {
  const content = contentStream(ops);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Title ${pdfString(title)} /Producer (Raven) >>`,
  ];

  let body = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  for (const [i, object] of objects.entries()) {
    offsets.push(encoder.encode(body).length);
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = encoder.encode(body).length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(body);
}
