import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { a2aRouter } from "../../../src/a2a";
import { agentDirectory } from "../../../src/a2a/agent-directory";
import { issueSessionFor } from "../../../src/auth/session";
import type { GeminiContent } from "../../../src/integrations/gemini";
import { agents } from "../../../src/agents/core/registry";
import { call, fakeDeps } from "../fakes";
import { fixtures } from "./fixtures";

// the real directory and orchestrator behind the real router; only the model and outside services are fake
function setup(replies: GeminiContent[] = []) {
  const fake = fakeDeps({ replies });
  const app = a2aRouter(() => agentDirectory(fake.deps));
  const rpc = async (user: string, method: string, params: Record<string, unknown>) => {
    const headers = { "Content-Type": "application/json", "A2A-Version": "1.0", Authorization: `Bearer ${await issueSessionFor(env.SESSION_SECRET, user)}` };
    const res = await app.request("https://skillit.example/a2a", { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }, env);
    return (await res.json()) as { result?: any; error?: { code: number; message: string } };
  };
  const send = (user: string, skillId: string, input: unknown) =>
    rpc(user, "SendMessage", { message: { messageId: "m1", role: "ROLE_USER", parts: [{ data: { skillId, input } }] } });
  return { ...fake, app, rpc, send };
}

describe("A2A, end to end", () => {
  it("publishes every app skill on the agent card and nothing internal", async () => {
    const { app } = setup();
    const card = (await (await app.request("https://skillit.example/.well-known/agent-card.json", {}, env)).json()) as { skills: { id: string }[] };
    const appSkills = agents.flatMap((a) => Object.values(a.skills)).filter((s) => s.platforms.includes("app")).map((s) => s.name);
    expect(card.skills.map((s) => s.id).sort()).toEqual(appSkills.sort());
    expect(card.skills.map((s) => s.id)).not.toContain("research-company");
    expect(card.skills.map((s) => s.id)).not.toContain("interview-intel");
  });

  it("runs a skill for the caller and lets only that caller read the task back", async () => {
    const { send, rpc, memoryFor } = setup([call("finish", fixtures["career-snapshot"].output)]);
    const { result } = await send("a2a-u1", "career-snapshot", {});
    expect(result.task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(result.task.artifacts[0].parts[0].data).toEqual(fixtures["career-snapshot"].output);
    expect(memoryFor).toHaveBeenCalledWith("a2a-u1");

    expect((await rpc("a2a-u1", "GetTask", { id: result.task.id })).result.status.state).toBe("TASK_STATE_COMPLETED");
    expect((await rpc("a2a-u2", "GetTask", { id: result.task.id })).error?.code).toBe(-32001);
  });

  it("refuses internal skills and bad input before any model call", async () => {
    const { send, prompts } = setup();
    expect((await send("a2a-u3", "research-company", { company: "acme" })).error?.code).toBe(-32602);
    expect((await send("a2a-u4", "roadmap-steps", { goal: "x" })).error?.code).toBe(-32602);
    expect(prompts).toEqual([]);
  });

  it("rejects tailor requirements without a topic up front instead of crashing after the model call", async () => {
    const change = { action: "rewrite", path: "summary", before: "Built a small booking app for a campus club.", after: "Built a booking app.", why: "Plainer.", requirement: 1 };
    const { send, prompts } = setup([call("finish", { changes: [change] })]);
    const input = { ...fixtures["resume-tailor"].input, requirements: [{ text: "React", required: true }] };
    expect((await send("a2a-u6", "resume-tailor", input)).error?.code).toBe(-32602);
    expect(prompts).toEqual([]);
  });

  it("reports a failed run with a fixed message, never the model's error", async () => {
    const { send, deps } = setup();
    deps.model = () => async () => {
      throw new Error("GEMINI_KEY=abc leaked");
    };
    const { result } = await send("a2a-u5", "career-snapshot", {});
    expect(result.task.status.state).toBe("TASK_STATE_FAILED");
    expect(JSON.stringify(result)).not.toContain("GEMINI_KEY");
  });
});
