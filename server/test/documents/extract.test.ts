import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { deps, extractText, UnreadableDocument } from "../../src/documents/extract";
import { RESUME_LINES, samples } from "./samples";

const read = (bytes: Uint8Array, name: string) => extractText(env, { bytes, name });

describe("extractText", () => {
  it.each([
    ["docx", samples.docx, "resume.docx"],
    ["odt", samples.odt, "resume.odt"],
    ["pptx", samples.pptx, "deck.pptx"],
    ["rtf", samples.rtf, "resume.rtf"],
    ["html", samples.html, "resume.html"],
    ["text", samples.text, "resume.txt"],
  ] as const)("reads %s locally, one line per paragraph", async (format, bytes, name) => {
    const doc = await read(bytes, name);
    expect(doc.format).toBe(format);
    expect(doc.text.split("\n").map((l) => l.trim()).filter(Boolean)).toEqual(RESUME_LINES);
  });

  it("drops scripts and styles from html", async () => {
    expect((await read(samples.html, "r.html")).text).not.toMatch(/alert|p\{\}/);
  });

  it("sends PDFs and images to the model to transcribe", async () => {
    const transcribe = vi.spyOn(deps, "transcribe").mockResolvedValue("Jordan Lee\nBuilt a Python Flask API");
    const doc = await read(samples.pdf, "resume.pdf");
    expect(transcribe).toHaveBeenCalledWith(env, samples.pdf, "application/pdf");
    expect(doc).toMatchObject({ format: "pdf", text: "Jordan Lee\nBuilt a Python Flask API" });
    transcribe.mockRestore();
  });

  it("rejects unknown formats, empty documents and oversized text", async () => {
    await expect(read(samples.legacyDoc, "old.doc")).rejects.toBeInstanceOf(UnreadableDocument);
    await expect(read(new TextEncoder().encode("   "), "blank.txt")).rejects.toBeInstanceOf(UnreadableDocument);
  });
});
