import { RunRejected } from "../agents/core/harness";
import { cards } from "../agents/core/registry";
import { findRun } from "../agents/core/runs";
import type { AgentDeps } from "../agents/core/types";
import { orchestrate } from "../agents/orchestrator";
import { RpcError, invalidParams } from "./jsonrpc";
import type { AgentCard, AgentDirectory, DirectoryRun } from "./directory";
import { ErrorCode } from "./types";

// Model and tool errors can carry internals (prompts, URLs, stack text), so outside callers get one fixed message.
const FAILED = "The agent could not finish this task.";

// Outside agents act like the app: VR-only and background-only skills stay internal.
function appCards(): AgentCard[] {
  return cards()
    .map((card) => ({ ...card, skills: card.skills.filter((skill) => skill.platforms.includes("app")) }))
    .filter((card) => card.skills.length > 0);
}

function toRpcError(rejected: RunRejected): RpcError {
  if (rejected.status === 429) return new RpcError(ErrorCode.rateLimited, rejected.message, undefined, 429);
  return invalidParams("message.parts.data.input", rejected.message);
}

export function agentDirectory(deps: AgentDeps): AgentDirectory {
  return {
    cards: appCards,

    async run({ skillId, userId, input }): Promise<DirectoryRun> {
      try {
        const run = await orchestrate(deps, { skillId, platform: "app", userId, input });
        if (run.status === "done") return { status: "done", runId: run.runId, output: run.output };
        return { status: "failed", runId: run.runId, error: FAILED };
      } catch (e) {
        if (e instanceof RunRejected) throw toRpcError(e);
        throw e;
      }
    },

    async findRun(runId, userId) {
      const run = await findRun(deps.env, runId, userId);
      if (!run) return null;
      if (run.status === "done" && run.output) return { status: "done", runId, output: run.output };
      if (run.status === "failed") return { status: "failed", runId, error: FAILED };
      return { status: "running", runId };
    },
  };
}
