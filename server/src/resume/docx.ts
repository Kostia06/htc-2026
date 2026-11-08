import { strToU8, zipSync } from "fflate";
import { type DocEntry, type ResumeDoc, type ResumeTemplate, resumeDoc } from "./template";
import type { Resume } from "./types";

// A Word file is a zip of XML parts. Three parts are enough for Word, Pages and Google Docs to open it,
// and plain paragraphs (no tables, no text boxes) keep it readable by applicant tracking systems.

type Look = { font: string; accent: string; muted: string; centered: boolean; margin: { top: number; side: number } };
const LOOKS: Record<ResumeTemplate, Look> = {
  skillit: { font: "Calibri", accent: "1E3A5F", muted: "444444", centered: true, margin: { top: 360, side: 720 } },
  plain: { font: "Arial", accent: "000000", muted: "555555", centered: false, margin: { top: 1080, side: 1080 } },
};
const PAGE_WIDTH = 12240; // Letter, in twentieths of a point
const BODY = 20; // half-points: 10pt

type Run = { text: string; bold?: boolean; italic?: boolean; color?: string; size?: number; spacing?: number };
type Para = { runs: Run[]; center?: boolean; before?: number; after?: number; rule?: string; rightTab?: number; bullet?: boolean };

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function run(r: Run, font: string) {
  const props = [
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`,
    r.bold ? "<w:b/>" : "",
    r.italic ? "<w:i/>" : "",
    r.color ? `<w:color w:val="${r.color}"/>` : "",
    r.spacing ? `<w:spacing w:val="${r.spacing}"/>` : "",
    `<w:sz w:val="${r.size ?? BODY}"/>`,
  ].join("");
  // a tab inside the text is a real tab stop, so the date can sit flush right
  const pieces = r.text.split("\t").map((piece) => `<w:t xml:space="preserve">${escape(piece)}</w:t>`);
  return `<w:r><w:rPr>${props}</w:rPr>${pieces.join("<w:tab/>")}</w:r>`;
}

function paragraph(p: Para, font: string) {
  // WordprocessingML is strict about child order inside pPr: borders, tabs, spacing, indent, alignment
  const props = [
    p.rule ? `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="${p.rule}"/></w:pBdr>` : "",
    p.rightTab ? `<w:tabs><w:tab w:val="right" w:pos="${p.rightTab}"/></w:tabs>` : "",
    p.bullet ? '<w:tabs><w:tab w:val="left" w:pos="320"/></w:tabs>' : "",
    `<w:spacing w:before="${p.before ?? 0}" w:after="${p.after ?? 0}" w:line="264" w:lineRule="auto"/>`,
    p.bullet ? '<w:ind w:left="320" w:right="500" w:hanging="200"/>' : "",
    p.center ? '<w:jc w:val="center"/>' : "",
  ].join("");
  const runs = p.bullet ? [{ ...p.runs[0], text: `•\t${p.runs[0].text}` }] : p.runs;
  return `<w:p><w:pPr>${props}</w:pPr>${runs.map((r) => run(r, font)).join("")}</w:p>`;
}

function body(doc: ResumeDoc, look: Look): Para[] {
  const textWidth = PAGE_WIDTH - look.margin.side * 2;
  const paras: Para[] = [
    { runs: [{ text: doc.name, bold: true, color: look.accent, size: 38, spacing: 15 }], center: look.centered, after: 40 },
    { runs: [{ text: doc.contact.join(" | "), color: "333333" }], center: look.centered, after: 40, rule: doc.headline ? undefined : look.accent },
  ];
  if (doc.headline) paras.push({ runs: [{ text: doc.headline, italic: true, color: look.muted }], center: look.centered, after: 80, rule: look.accent });
  const entry = (item: DocEntry) => {
    paras.push({ runs: [{ text: item.title, bold: true }, { text: item.date ? `\t${item.date}` : "", color: "555555" }], rightTab: textWidth });
    if (item.subtitle) paras.push({ runs: [{ text: item.subtitle, italic: true, color: look.muted }] });
    for (const bullet of item.bullets) paras.push({ runs: [{ text: bullet }], bullet: true });
    paras[paras.length - 1].after = 100;
  };
  for (const section of doc.sections) {
    paras.push({ runs: [{ text: section.title.toUpperCase(), bold: true, color: look.accent, spacing: 15 }], rule: look.accent, before: 100, after: 40 });
    if (section.text) paras.push({ runs: [{ text: section.text }], after: 100 });
    for (const item of section.entries ?? []) entry(item);
    for (const row of section.rows ?? []) paras.push({ runs: [{ text: row.key ? `${row.key}: ` : "", bold: true }, { text: row.value }], after: 20 });
  }
  return paras;
}

function documentXml(doc: ResumeDoc, look: Look) {
  const paras = body(doc, look).map((p) => paragraph(p, look.font)).join("");
  const section = `<w:sectPr><w:pgSz w:w="${PAGE_WIDTH}" w:h="15840"/><w:pgMar w:top="${look.margin.top}" w:bottom="${look.margin.top}" w:left="${look.margin.side}" w:right="${look.margin.side}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}${section}</w:body></w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function renderResumeDOCX(resume: Resume, template: ResumeTemplate = "skillit"): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(RELS),
    "word/document.xml": strToU8(documentXml(resumeDoc(resume, template), LOOKS[template])),
  });
}
