import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { readDocumentTool } from "../../../../src/agents/resume/tools/read-document";
import { saveDocument } from "../../../../src/documents/store";
import { toolContext } from "../../fakes";

describe("read_document", () => {
  it("returns this person's document wrapped as their own data", async () => {
    const id = await saveDocument(env, "u1", { name: "resume.docx", format: "docx", text: "Built a Flask API" });
    const out = (await readDocumentTool.run({ document_id: id }, toolContext({ userId: "u1" }))) as { text: string; format: string };
    expect(out.format).toBe("docx");
    expect(out.text).toContain("Built a Flask API");
    expect(out.text).toContain("<user-document>");
  });

  it("cannot open another person's document", async () => {
    const id = await saveDocument(env, "u1", { name: "resume.docx", format: "docx", text: "secret" });
    expect(await readDocumentTool.run({ document_id: id }, toolContext({ userId: "u2" }))).toMatchObject({ error: "document not found" });
  });
});
