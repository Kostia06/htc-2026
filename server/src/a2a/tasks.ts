import type { AgentCard, DirectoryRun } from "./directory";
import { invalidParams, isObject } from "./jsonrpc";
import type { Task } from "./types";

export type SkillCall = { skillId: string; input: unknown };

// Only a data part's declared skillId selects work; text parts are untrusted and never read.
export function readSkillCall(params: Record<string, unknown>, cards: AgentCard[]): SkillCall & { taskId?: string } {
  const message = params.message;
  if (!isObject(message) || typeof message.messageId !== "string" || !Array.isArray(message.parts)) {
    throw invalidParams("message", "a message with messageId and parts is required");
  }
  if (message.role !== "ROLE_USER") throw invalidParams("message.role", "must be ROLE_USER");
  const call = message.parts.find((part) => isObject(part) && isObject(part.data) && typeof part.data.skillId === "string");
  if (!call) throw invalidParams("message.parts", 'one data part {"skillId","input"} is required');
  const { skillId, input } = call.data as { skillId: string; input?: unknown };
  if (!cards.some((card) => card.skills.some((skill) => skill.id === skillId))) {
    throw invalidParams("message.parts.data.skillId", "unknown skill; see the agent card");
  }
  return { skillId, input: input ?? {}, ...(typeof message.taskId === "string" ? { taskId: message.taskId } : {}) };
}

// The run id doubles as context id: each run is its own single-turn conversation.
export function runToTask(run: DirectoryRun | { status: "running"; runId: string }): Task {
  const base = { id: run.runId, contextId: run.runId };
  if (run.status === "running") return { ...base, status: { state: "TASK_STATE_WORKING" } };
  if (run.status === "failed") {
    return {
      ...base,
      status: {
        state: "TASK_STATE_FAILED",
        message: { messageId: `${run.runId}-error`, role: "ROLE_AGENT", contextId: run.runId, taskId: run.runId, parts: [{ text: run.error }] },
      },
    };
  }
  return {
    ...base,
    status: { state: "TASK_STATE_COMPLETED" },
    artifacts: [{ artifactId: "output", name: "output", parts: [{ data: run.output, mediaType: "application/json" }] }],
  };
}
