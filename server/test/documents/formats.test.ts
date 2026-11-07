import { describe, expect, it } from "vitest";
import { detectFormat } from "../../src/documents/formats";
import { samples } from "./samples";

describe("detectFormat", () => {
  it.each([
    ["pdf", samples.pdf, "resume.pdf"],
    ["png", samples.png, "scan.png"],
    ["jpeg", samples.jpeg, "photo.jpg"],
    ["webp", samples.webp, "photo.webp"],
    ["heic", samples.heic, "IMG_0001.HEIC"],
    ["rtf", samples.rtf, "resume.rtf"],
    ["docx", samples.docx, "resume.docx"],
    ["odt", samples.odt, "resume.odt"],
    ["pptx", samples.pptx, "portfolio.pptx"],
    ["html", samples.html, "resume.html"],
    ["text", samples.text, "resume.md"],
  ] as const)("recognises %s from its bytes", (format, bytes, name) => {
    expect(detectFormat(bytes, name)).toBe(format);
  });

  it("trusts the bytes over a misleading file name", () => {
    expect(detectFormat(samples.pdf, "resume.docx")).toBe("pdf");
  });

  it("refuses formats it cannot read", () => {
    expect(detectFormat(samples.legacyDoc, "resume.doc")).toBeNull();
    expect(detectFormat(new Uint8Array([0, 159, 146, 150, 0, 1]), "blob.bin")).toBeNull();
  });
});
