import { layoutPlain } from "./pdf-plain";
import { layoutSkillit } from "./pdf-skillit";
import { writePDF } from "./pdf-writer";
import type { ResumeTemplate } from "./template";
import type { Resume } from "./types";

export function layoutResume(resume: Resume, template: ResumeTemplate = "skillit") {
  const page = template === "plain" ? layoutPlain(resume) : layoutSkillit(resume);
  return { ops: page.ops, truncated: page.truncated };
}

export function renderResumePDF(resume: Resume, template: ResumeTemplate = "skillit"): { bytes: Uint8Array; truncated: boolean } {
  const { ops, truncated } = layoutResume(resume, template);
  return { bytes: writePDF(ops, `${resume.contact.name || "Resume"} - Resume`), truncated };
}
