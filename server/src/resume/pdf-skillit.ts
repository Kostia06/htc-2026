import { Layout } from "./pdf-layout";
import { type Ink, wrap } from "./pdf-writer";
import { type DocEntry, type DocRow, skillitDoc } from "./template";
import type { Resume } from "./types";

// the Skillit default: centred navy header, navy section rules, italic subtitles, dates flush right.
// Calibri isn't one of the PDF standard fonts, so Helvetica stands in at the same sizes.
const NAVY: Ink = [30 / 255, 58 / 255, 95 / 255];
const INK: Ink = 0.1;
const SIZE = 10;
const LINE = 13;
const BODY = { font: "F1", size: SIZE, ink: INK } as const;
const BOLD = { font: "F2", size: SIZE, ink: INK } as const;
const ITALIC = { font: "F3", size: SIZE, ink: 0.27 } as const;
const DATE = { font: "F1", size: SIZE, ink: 0.33 } as const;

function header(page: Layout, name: string, contact: string[], headline: string) {
  page.line(name, { font: "F2", size: 19, ink: NAVY, spacing: 0.75 }, { center: true, advance: 22 });
  page.paragraph(contact.join(" | "), { font: "F1", size: SIZE, ink: 0.2 }, { center: true, advance: LINE });
  if (headline) {
    page.down(2);
    page.paragraph(headline, ITALIC, { center: true, advance: LINE });
  }
  page.down(2);
  page.rule(NAVY, 1.5);
  page.down(5);
}

function sectionTitle(page: Layout, title: string) {
  if (!page.fits(30)) return;
  page.down(3);
  page.line(title.toUpperCase(), { font: "F2", size: SIZE, ink: NAVY, spacing: 0.75 }, { advance: 12 });
  page.rule(NAVY, 1.5);
  page.down(4);
}

function entry(page: Layout, item: DocEntry) {
  const dateWidth = item.date ? page.measure(item.date, DATE) + 12 : 0;
  const titleLines = wrap(item.title, BOLD.font, BOLD.size, page.width - dateWidth);
  if (item.date && page.fits(SIZE)) page.place(item.date, DATE, page.right - page.measure(item.date, DATE));
  for (const piece of titleLines) page.line(piece, BOLD, { advance: LINE });
  if (item.subtitle) page.paragraph(item.subtitle, ITALIC, { width: page.width - dateWidth, advance: LINE });
  page.bullets(item.bullets, BODY, { indent: 14, rightPad: 25, advance: LINE });
  page.down(4);
}

// a bold "Languages:" label with the values running on after it, wrapping back to the margin
function skillRow(page: Layout, row: DocRow) {
  const label = row.key ? `${row.key}: ` : "";
  const labelWidth = label ? page.measure(label, BOLD) : 0;
  const [first = "", ...rest] = wrap(row.value, BODY.font, SIZE, page.width - labelWidth);
  if (!page.fits(SIZE)) return;
  if (label) page.place(label, BOLD, page.left);
  page.line(first, BODY, { x: page.left + labelWidth, advance: LINE });
  page.paragraph(rest.join(" "), BODY, { advance: LINE });
}

export function layoutSkillit(resume: Resume) {
  const doc = skillitDoc(resume);
  const page = new Layout({ top: 22, bottom: 22, side: 36 });
  header(page, doc.name, doc.contact, doc.headline);
  for (const section of doc.sections) {
    sectionTitle(page, section.title);
    for (const item of section.entries ?? []) entry(page, item);
    for (const row of section.rows ?? []) skillRow(page, row);
    page.down(3);
  }
  return page;
}
