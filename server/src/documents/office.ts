import { strFromU8, unzipSync } from "fflate";
import { officeXmlToText } from "./markup";

type OfficeFormat = "docx" | "odt" | "pptx";

const slideNumber = (path: string) => Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);

const TEXT_PARTS: Record<OfficeFormat, (name: string) => boolean> = {
  docx: (name) => name === "word/document.xml",
  odt: (name) => name === "content.xml",
  pptx: (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name),
};

export function officeToText(bytes: Uint8Array, format: OfficeFormat) {
  const parts = unzipSync(bytes, { filter: (file) => TEXT_PARTS[format](file.name) });
  return Object.keys(parts)
    .sort((a, b) => slideNumber(a) - slideNumber(b))
    .map((name) => officeXmlToText(strFromU8(parts[name])))
    .join("\n");
}
