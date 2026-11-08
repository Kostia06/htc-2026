import { strToU8, zipSync } from "fflate";

const bytes = (...values: number[]) => new Uint8Array(values);

export const RESUME_LINES = ["Jordan Lee", "Built a Python Flask API for 2,000 users"];

export const samples = {
  pdf: new TextEncoder().encode("%PDF-1.7\n..."),
  png: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0),
  jpeg: bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0),
  webp: new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "),
  heic: new TextEncoder().encode("\0\0\0\x18ftypheic\0\0\0\0"),
  rtf: new TextEncoder().encode("{\\rtf1\\ansi {\\b Jordan Lee}\\par Built a Python Flask API for 2,000 users\\par}"),
  html: new TextEncoder().encode("<html><style>p{}</style><body><h1>Jordan Lee</h1><script>alert(1)</script><p>Built a Python Flask API for 2,000 users</p></body></html>"),
  text: new TextEncoder().encode(RESUME_LINES.join("\n")),
  legacyDoc: bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1),
  docx: zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/document.xml": strToU8(
      `<w:document><w:body>${RESUME_LINES.map((l) => `<w:p><w:r><w:t>${l.replace("&", "&amp;")}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`,
    ),
  }),
  odt: zipSync({
    mimetype: strToU8("application/vnd.oasis.opendocument.text"),
    "content.xml": strToU8(`<office:document-content><office:body>${RESUME_LINES.map((l) => `<text:p>${l}</text:p>`).join("")}</office:body></office:document-content>`),
  }),
  pptx: zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "ppt/slides/slide1.xml": strToU8(`<p:sld>${RESUME_LINES.map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join("")}</p:sld>`),
  }),
};
