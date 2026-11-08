import { describe, expect, it } from "vitest";
import { layoutResume, renderResumePDF } from "../../src/resume/pdf";
import { PAGE, wrap, writePDF } from "../../src/resume/pdf-writer";
import { sampleResume } from "./fixtures";

const decoder = new TextDecoder("latin1");

// a reader follows startxref to the table, then each offset to its object: both must land exactly
function checkCrossReferences(bytes: Uint8Array) {
  const text = decoder.decode(bytes);
  const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)?.[1]);
  expect(text.slice(startxref, startxref + 4)).toBe("xref");
  const entries = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  expect(entries.length).toBeGreaterThan(0);
  entries.forEach((offset, i) => expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
}

describe("pdf writer", () => {
  it("wraps text at the given width and never drops a word", () => {
    const lines = wrap("Wrote SQL reports in Postgres for the lending team every week", "F1", 10, 120);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("Wrote SQL reports in Postgres for the lending team every week");
  });

  it("writes a one-page PDF with valid offsets and escaped text", () => {
    const bytes = writePDF([{ kind: "text", x: 10, y: 10, font: "F1", size: 10, text: "Flask (API) \\ done – ok" }], "Test");
    const text = decoder.decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 1");
    expect(text).toContain("(Flask \\(API\\) \\\\ done - ok) Tj");
    checkCrossReferences(bytes);
  });
});

describe("resume pdf", () => {
  it("lays the resume out top to bottom within the page", () => {
    const { ops, truncated } = layoutResume(sampleResume);
    const texts = ops.filter((op) => op.kind === "text").map((op) => op.text);
    expect(texts[0]).toBe("Jordan Lee");
    expect(texts).toContain("EXPERIENCE");
    expect(texts).toContain("Software Developer Co-op, ATB Financial");
    expect(texts).toContain("Python, SQL, SwiftUI");
    expect(truncated).toBe(false);
    for (const op of ops) expect(op.y).toBeGreaterThan(0);
    expect(ops.every((op) => op.y < PAGE.height)).toBe(true);
  });

  it("stops at the bottom of the page instead of spilling onto a second one", () => {
    const bullets = Array.from({ length: 40 }, (_, i) => `Did a thing number ${i} that took a whole line of text to describe properly`);
    const long = { ...sampleResume, experience: Array.from({ length: 6 }, () => ({ ...sampleResume.experience[0], bullets })) };
    const { bytes, truncated } = renderResumePDF(long);
    expect(truncated).toBe(true);
    expect(decoder.decode(bytes)).toContain("/Count 1");
    checkCrossReferences(bytes);
  });

  it("renders the sample resume as a readable PDF", () => {
    const { bytes } = renderResumePDF(sampleResume);
    const text = decoder.decode(bytes);
    expect(text).toContain("(Jordan Lee) Tj");
    expect(text).toContain("/Helvetica-Bold");
    checkCrossReferences(bytes);
  });
});
