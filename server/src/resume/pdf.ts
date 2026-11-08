import { type Font, type Op, PAGE, textWidth, wrap, writePDF } from "./pdf-writer";
import type { Resume } from "./types";

const MARGIN = 54;
const WIDTH = PAGE.width - MARGIN * 2;
const BODY = 10;
const LINE = 13;
const MUTED = 0.4;

// lays the resume out top to bottom and stops at the page edge: one page, always, so the end may be cut
class Layout {
  readonly ops: Op[] = [];
  truncated = false;
  private y = PAGE.height - MARGIN;

  private fits(height: number) {
    if (this.y - height < MARGIN) this.truncated = true;
    return !this.truncated;
  }

  text(text: string, font: Font, size: number, opts: { x?: number; gray?: number; advance?: number } = {}) {
    if (!text || !this.fits(size)) return;
    this.ops.push({ kind: "text", x: opts.x ?? MARGIN, y: this.y - size, font, size, text, gray: opts.gray });
    this.y -= opts.advance ?? size + 4;
  }

  // a bold title on the left with a muted note (dates, year, link) on the same baseline at the right edge
  titleLine(left: string, right: string) {
    const size = BODY + 0.5;
    if (!left || !this.fits(size)) return;
    const baseline = this.y - size;
    this.ops.push({ kind: "text", x: MARGIN, y: baseline, font: "F2", size, text: left });
    if (right) {
      this.ops.push({ kind: "text", x: PAGE.width - MARGIN - textWidth(right, "F1", 9), y: baseline, font: "F1", size: 9, text: right, gray: MUTED });
    }
    this.y -= LINE + 1;
  }

  paragraph(text: string, opts: { x?: number; width?: number; gray?: number } = {}) {
    for (const line of wrap(text, "F1", BODY, opts.width ?? WIDTH)) this.text(line, "F1", BODY, { x: opts.x, gray: opts.gray, advance: LINE });
  }

  bullets(items: string[]) {
    for (const item of items) {
      const lines = wrap(item, "F1", BODY, WIDTH - 14);
      lines.forEach((line, i) => {
        if (i === 0 && this.fits(BODY)) this.ops.push({ kind: "text", x: MARGIN + 2, y: this.y - BODY, font: "F1", size: BODY, text: "•" });
        this.text(line, "F1", BODY, { x: MARGIN + 14, advance: LINE });
      });
    }
  }

  heading(title: string) {
    if (!this.fits(26)) return;
    this.y -= 8;
    this.text(title.toUpperCase(), "F2", 9, { gray: 0.25, advance: 12 });
    this.ops.push({ kind: "rule", x: MARGIN, y: this.y, width: WIDTH, gray: 0.75 });
    this.y -= 7;
  }

  gap(height: number) {
    this.y -= height;
  }
}

const joinPresent = (parts: string[], separator: string) => parts.filter(Boolean).join(separator);
const dates = (start: string, end: string) => joinPresent([start, end], " – ");

export function layoutResume(resume: Resume) {
  const page = new Layout();
  page.text(resume.contact.name || "Resume", "F2", 20, { advance: 26 });
  page.text(joinPresent([resume.contact.email, resume.contact.phone, ...resume.contact.links], "  ·  "), "F1", 9, { gray: MUTED, advance: 14 });

  if (resume.summary) {
    page.heading("Summary");
    page.paragraph(resume.summary);
  }
  if (resume.experience.length) {
    page.heading("Experience");
    for (const job of resume.experience) {
      page.titleLine(joinPresent([job.role, job.org], ", "), dates(job.start, job.end));
      page.bullets(job.bullets);
      page.gap(5);
    }
  }
  if (resume.education.length) {
    page.heading("Education");
    for (const school of resume.education) {
      page.titleLine(school.school, school.year);
      if (school.program) page.text(school.program, "F1", BODY, { advance: LINE });
      page.gap(4);
    }
  }
  if (resume.projects.length) {
    page.heading("Projects");
    for (const project of resume.projects) {
      page.titleLine(project.name, project.link);
      page.bullets(project.bullets);
      page.gap(5);
    }
  }
  if (resume.skills.length) {
    page.heading("Skills");
    page.paragraph(resume.skills.join(", "));
  }
  return { ops: page.ops, truncated: page.truncated };
}

export function renderResumePDF(resume: Resume): { bytes: Uint8Array; truncated: boolean } {
  const { ops, truncated } = layoutResume(resume);
  return { bytes: writePDF(ops, `${resume.contact.name || "Resume"} - Resume`), truncated };
}
