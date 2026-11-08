import { DOCX_TYPE, renderResumeDOCX } from "./docx";
import { renderResumePDF } from "./pdf";
import { type ResumeFormat, type ResumeTemplate } from "./template";
import type { Resume } from "./types";

// one place that turns a resume into the file the person downloads, whichever format and layout they chose
export function resumeFile(resume: Resume, format: ResumeFormat, template: ResumeTemplate) {
  if (format === "docx") return { bytes: renderResumeDOCX(resume, template), type: DOCX_TYPE, truncated: false };
  const { bytes, truncated } = renderResumePDF(resume, template);
  return { bytes, type: "application/pdf", truncated };
}

export function resumeFileHeaders(file: ReturnType<typeof resumeFile>, name: string, format: ResumeFormat) {
  return {
    "Content-Type": file.type,
    "Content-Disposition": `attachment; filename="${name}.${format}"`,
    "X-Resume-Truncated": file.truncated ? "1" : "0",
  };
}
