// A minimal PDF 1.4 writer: one Letter page, the standard Helvetica fonts, no compression.
// Just enough for a clean text resume, with nothing to install in the Worker.

export type Font = "F1" | "F2" | "F3"; // regular, bold, italic
export const PAGE = { width: 612, height: 792 } as const;

// ink is either a gray level (0 black, 1 white) or an RGB triple in 0..1
export type Ink = number | readonly [number, number, number];
export type TextOp = { kind: "text"; x: number; y: number; font: Font; size: number; text: string; gray?: Ink; spacing?: number };
export type RuleOp = { kind: "rule"; x: number; y: number; width: number; gray?: Ink; thickness?: number };
export type Op = TextOp | RuleOp;

// Helvetica advance widths per 1000 em for ASCII 32..126, from the Adobe font metrics, so centred and
// right-aligned text lands where a reader draws it. Oblique shares the regular widths.
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];
// the stand-ins pdfString writes for typographic characters
const SPECIAL: Record<string, number> = { "•": 350, "·": 278, "–": 333, "—": 333, "‘": 191, "’": 191, "“": 355, "”": 355 };

function charWidth(char: string, font: Font) {
  const code = char.charCodeAt(0);
  if (code >= 32 && code <= 126) return (font === "F2" ? BOLD : REGULAR)[code - 32];
  return SPECIAL[char] ?? 556;
}

// spacing is extra space after every glyph but the last, the same as the PDF Tc operator
export function textWidth(text: string, font: Font, size: number, spacing = 0) {
  let units = 0;
  let count = 0;
  for (const char of text) {
    units += charWidth(char, font);
    count += 1;
  }
  return (units / 1000) * size + spacing * Math.max(0, count - 1);
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

function fill(ink: Ink = 0) {
  return typeof ink === "number" ? `${ink.toFixed(2)} g` : `${ink.map((c) => c.toFixed(3)).join(" ")} rg`;
}

function contentStream(ops: Op[]) {
  const lines: string[] = [];
  for (const op of ops) {
    if (op.kind === "rule") {
      lines.push(`${fill(op.gray)} ${op.x.toFixed(2)} ${op.y.toFixed(2)} ${op.width.toFixed(2)} ${(op.thickness ?? 0.6).toFixed(2)} re f`);
    } else {
      const spacing = op.spacing ? ` ${op.spacing.toFixed(2)} Tc` : " 0 Tc";
      lines.push(`BT ${fill(op.gray)} /${op.font} ${op.size} Tf${spacing} 1 0 0 1 ${op.x.toFixed(2)} ${op.y.toFixed(2)} Tm ${pdfString(op.text)} Tj ET`);
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
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>",
    `<< /Title ${pdfString(title)} /Producer (Skillit) >>`,
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
