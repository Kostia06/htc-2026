import { unzipSync } from "fflate";

export type DocumentFormat = "pdf" | "png" | "jpeg" | "webp" | "heic" | "rtf" | "docx" | "odt" | "pptx" | "html" | "text";

// formats only the model can read; the rest are turned into text inside the Worker
export const MODEL_READ_MIME = { pdf: "application/pdf", png: "image/png", jpeg: "image/jpeg", webp: "image/webp", heic: "image/heic" } as const;
export type ModelReadFormat = keyof typeof MODEL_READ_MIME;
export const isModelRead = (format: DocumentFormat): format is ModelReadFormat => format in MODEL_READ_MIME;

const HEIF_BRANDS = ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1", "heif"];
const HTML_EXTENSIONS = ["html", "htm"];

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);
const extensionOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";

function zipEntries(bytes: Uint8Array): string[] {
  const names: string[] = [];
  try {
    unzipSync(bytes, { filter: (file) => (names.push(file.name), false) });
  } catch {
    return [];
  }
  return names;
}

function officeFormat(bytes: Uint8Array): DocumentFormat | null {
  const entries = zipEntries(bytes);
  if (entries.includes("word/document.xml")) return "docx";
  if (entries.some((e) => e.startsWith("ppt/slides/"))) return "pptx";
  if (entries.includes("content.xml") && entries.includes("mimetype")) return "odt";
  return null;
}

function readableText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return null;
  }
}

// the bytes decide, not the file name: a renamed PDF is still a PDF, and a .docx that isn't a zip is not a Word file
export function detectFormat(bytes: Uint8Array, name: string): DocumentFormat | null {
  if (ascii(bytes, 0, 5) === "%PDF-") return "pdf";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  if (ascii(bytes, 4, 8) === "ftyp" && HEIF_BRANDS.includes(ascii(bytes, 8, 12))) return "heic";
  if (ascii(bytes, 0, 5) === "{\\rtf") return "rtf";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return officeFormat(bytes);

  const text = readableText(bytes);
  if (text === null) return null;
  const extension = extensionOf(name);
  if (HTML_EXTENSIONS.includes(extension) || /^\s*<(!doctype html|html|body)/i.test(text)) return "html";
  // any other valid UTF-8 without NUL bytes is plain text: .txt, .md, .tex, a pasted resume with no extension
  return "text";
}
