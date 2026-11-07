import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { a2aRouter, wellKnownCard } from "../../src/a2a";
import { cards, fakeDirectory } from "./fake-directory";

describe("wellKnownCard", () => {
  const card = wellKnownCard("https://raven.example", cards);

  it("carries the AgentCard required fields", () => {
    expect(card.name).toBe("Raven");
    expect(card.description).toBeTruthy();
    expect(card.version).toBeTruthy();
    expect(card.capabilities).toEqual({ streaming: false, pushNotifications: false, extendedAgentCard: false });
    expect(card.defaultInputModes).toEqual(["application/json"]);
    expect(card.defaultOutputModes).toEqual(["application/json"]);
  });

  it("points its JSON-RPC interface at /a2a on the given origin", () => {
    expect(card.supportedInterfaces).toEqual([{ url: "https://raven.example/a2a", protocolBinding: "JSONRPC", protocolVersion: "1.0" }]);
  });

  it("declares bearer auth and requires it", () => {
    expect(card.securitySchemes.bearer.httpAuthSecurityScheme.scheme).toBe("Bearer");
    expect(card.securityRequirements).toEqual([{ schemes: { bearer: { list: [] } } }]);
  });

  it("lists every internal skill, tagged with its agent", () => {
    expect(card.skills.map((s) => s.id)).toEqual(["tailor-resume", "research-company"]);
    const tailor = card.skills[0]!;
    expect(tailor.name).toBe("Tailor resume");
    expect(tailor.tags).toEqual(["resume"]);
    expect(tailor.inputModes).toEqual(["application/json"]);
    expect(tailor.outputModes).toEqual(["application/json"]);
    expect(tailor.description).toContain("Tailors a resume to a job.");
    expect(tailor.description).toContain('"jobId"');
    expect(JSON.parse(tailor.examples[0]!)).toEqual({ skillId: "tailor-resume", input: {} });
  });
});

describe("GET /.well-known/agent-card.json", () => {
  it("serves the card without auth, using the request origin", async () => {
    const app = a2aRouter(() => fakeDirectory().directory);
    const res = await app.request("https://raven.example/.well-known/agent-card.json", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { supportedInterfaces: { url: string }[]; skills: unknown[] };
    expect(body.supportedInterfaces[0]!.url).toBe("https://raven.example/a2a");
    expect(body.skills).toHaveLength(2);
  });
});
