import { Layout } from "./pdf-layout";
import { PAGE } from "./pdf-writer";
import type { Resume } from "./types";
import { plainDoc } from "./template";

// the plain layout: black Helvetica, left aligned, light rules. Kept for postings that want a bare ATS-style page.
const BODY = { font: "F1", size: 10 } as const;
const BOLD = { font: "F2", size: 10.5 } as const;
const NOTE = { font: "F1", size: 9, ink: 0.4 } as const;
const LINE = 13;

function titleLine(page: Layout, left: string, right: string) {
  if (!left || !page.fits(BOLD.size)) return;
  page.place(left, BOLD, page.left);
  if (right) page.place(right, NOTE, PAGE.width - page.left - page.measure(right, NOTE));
  page.down(LINE + 1);
}

function heading(page: Layout, title: string) {
  if (!page.fits(26)) return;
  page.down(8);
  page.line(title.toUpperCase(), { font: "F2", size: 9, ink: 0.25 }, { advance: 12 });
  page.rule(0.75, 0.6);
  page.down(7);
}

export function layoutPlain(resume: Resume) {
  const doc = plainDoc(resume);
  const page = new Layout({ top: 54, bottom: 54, side: 54 });
  page.line(doc.name, { font: "F2", size: 20 }, { advance: 26 });
  page.line(doc.contact.join("  ·  "), NOTE, { advance: 14 });

  for (const section of doc.sections) {
    heading(page, section.title);
    if (section.text) page.paragraph(section.text, BODY, { advance: LINE });
    for (const entry of section.entries ?? []) {
      titleLine(page, entry.title, entry.date);
      if (entry.subtitle) page.line(entry.subtitle, BODY, { advance: LINE });
      page.bullets(entry.bullets, BODY, { indent: 14, advance: LINE });
      page.down(entry.bullets.length ? 5 : 4);
    }
  }
  return page;
}
