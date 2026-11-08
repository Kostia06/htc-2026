import type { Env } from "../env";
import { generate } from "../integrations/gemini";

const PROMPT =
  "Transcribe every piece of text in this document exactly as written, top to bottom, keeping line breaks. " +
  "Output only the text, with no commentary. If there is no readable text, output nothing.";

// btoa over the whole file at once overflows the call stack on a few-megabyte PDF
function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function transcribe(env: Env, bytes: Uint8Array, mimeType: string) {
  const content = await generate(env, {
    contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: toBase64(bytes) } }, { text: PROMPT }] }],
  });
  return content.parts.map((p) => p.text ?? "").join("").trim();
}
