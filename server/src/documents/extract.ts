import type { Env } from "../env";
import { detectFormat, isModelRead, MODEL_READ_MIME, type DocumentFormat } from "./formats";
import { htmlToText, rtfToText } from "./markup";
import { officeToText } from "./office";
import { transcribe } from "./transcribe";

export const MAX_DOCUMENT_TEXT = 30_000;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class UnreadableDocument extends Error {}

export const deps = { transcribe };

export type ExtractedDocument = { format: DocumentFormat; text: string };

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

async function textOf(env: Env, bytes: Uint8Array, format: DocumentFormat) {
  if (isModelRead(format)) return deps.transcribe(env, bytes, MODEL_READ_MIME[format]);
  switch (format) {
    case "docx":
    case "odt":
    case "pptx":
      return officeToText(bytes, format);
    case "rtf":
      return rtfToText(decode(bytes));
    case "html":
      return htmlToText(decode(bytes));
    case "text":
      return decode(bytes).replace(/\r\n?/g, "\n");
  }
}

export async function extractText(env: Env, file: { bytes: Uint8Array; name: string }): Promise<ExtractedDocument> {
  const format = detectFormat(file.bytes, file.name);
  if (!format) throw new UnreadableDocument("this file type can't be read: try PDF, Word, Pages exported to PDF, an image or plain text");
  const text = (await textOf(env, file.bytes, format)).trim();
  if (!text) throw new UnreadableDocument("no readable text was found in this file");
  return { format, text: text.slice(0, MAX_DOCUMENT_TEXT) };
}
