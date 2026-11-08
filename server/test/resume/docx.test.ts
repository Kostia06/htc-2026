import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { officeToText } from "../../src/documents/office";
import { renderResumeDOCX } from "../../src/resume/docx";
import { sampleResume } from "./fixtures";

const documentXml = (bytes: Uint8Array) => strFromU8(unzipSync(bytes)["word/document.xml"]);

describe("resume docx", () => {
  it("writes a Word file our own reader can read back", () => {
    const text = officeToText(renderResumeDOCX(sampleResume), "docx");
    for (const part of ["Jordan Lee", "EDUCATION", "Software Developer Co-op", "ATB Financial", "Wrote SQL reports in Postgres"]) {
      expect(text).toContain(part);
    }
  });

  it("uses the navy Calibri look by default and plain Arial on request", () => {
    const skillit = documentXml(renderResumeDOCX(sampleResume));
    expect(skillit).toContain('w:ascii="Calibri"');
    expect(skillit).toContain('w:color="1E3A5F"');
    expect(skillit).toContain('<w:jc w:val="center"/>');
    const plain = documentXml(renderResumeDOCX(sampleResume, "plain"));
    expect(plain).toContain('w:ascii="Arial"');
    expect(plain).not.toContain("1E3A5F");
    expect(plain).toContain("SUMMARY");
  });

  it("escapes characters that would break the XML", () => {
    const xml = documentXml(renderResumeDOCX({ ...sampleResume, summary: 'R&D <lead> "fast"' }));
    expect(xml).toContain("R&amp;D &lt;lead&gt; &quot;fast&quot;");
  });
});
