import { type Context, Hono } from "hono";
import { requireSession } from "../auth/session";
import type { AppContext, Env } from "../env";
import { claimCooldown } from "../memory/cooldowns";
import { wellKnownCard } from "./card";
import type { AgentDirectory } from "./directory";
import { type RpcId, type RpcRequest, RpcError, invalidParams, parseEnvelope, rpcError, rpcResult, taskNotFound } from "./jsonrpc";
import { readSkillCall, runToTask } from "./tasks";
import { ErrorCode, PROTOCOL_VERSION } from "./types";

// each SendMessage can fan out to model calls, so one per user per window
const SEND_COOLDOWN_MS = 10_000;

type Call = { req: RpcRequest; userId: string; directory: AgentDirectory; env: Env };

const UNSUPPORTED: Record<string, RpcError> = {
  SendStreamingMessage: new RpcError(ErrorCode.unsupportedOperation, "Streaming is not supported"),
  SubscribeToTask: new RpcError(ErrorCode.unsupportedOperation, "Streaming is not supported"),
  CreateTaskPushNotificationConfig: new RpcError(ErrorCode.pushNotSupported, "Push notifications are not supported"),
  GetTaskPushNotificationConfig: new RpcError(ErrorCode.pushNotSupported, "Push notifications are not supported"),
  ListTaskPushNotificationConfigs: new RpcError(ErrorCode.pushNotSupported, "Push notifications are not supported"),
  DeleteTaskPushNotificationConfig: new RpcError(ErrorCode.pushNotSupported, "Push notifications are not supported"),
  GetExtendedAgentCard: new RpcError(ErrorCode.extendedCardNotConfigured, "Extended agent card is not configured"),
};

async function sendMessage({ req, userId, directory, env }: Call) {
  const call = readSkillCall(req.params, directory.cards());
  if (call.taskId) throw new RpcError(ErrorCode.unsupportedOperation, "Tasks are single-turn; start a new task");
  if (!(await claimCooldown(env, "a2a-send", userId, SEND_COOLDOWN_MS))) {
    throw new RpcError(ErrorCode.rateLimited, "Rate limited; retry later", undefined, 429);
  }
  const run = await directory.run({ skillId: call.skillId, userId, input: call.input });
  return { task: runToTask(run) };
}

async function findOwnRun({ req, userId, directory }: Call) {
  if (typeof req.params.id !== "string") throw invalidParams("id", "task id is required");
  const run = await directory.findRun(req.params.id, userId);
  if (!run) throw taskNotFound();
  return run;
}

const getTask = async (call: Call) => runToTask(await findOwnRun(call));

// runs finish inside SendMessage, so nothing is ever still cancelable by the time a client can name it
async function cancelTask(call: Call): Promise<never> {
  await findOwnRun(call);
  throw new RpcError(ErrorCode.taskNotCancelable, "Task cannot be canceled");
}

const METHODS: Record<string, (call: Call) => Promise<unknown>> = { SendMessage: sendMessage, GetTask: getTask, CancelTask: cancelTask };

function requestedVersion(c: Context<AppContext>) {
  // the spec says a missing version means 0.3, which this endpoint does not speak
  return c.req.header("A2A-Version") ?? c.req.query("A2A-Version") ?? "0.3";
}

export function a2aRouter(makeDirectory: (env: Env) => AgentDirectory) {
  return new Hono<AppContext>()
    .get("/.well-known/agent-card.json", (c) => c.json(wellKnownCard(new URL(c.req.url).origin, makeDirectory(c.env).cards())))
    .post("/a2a", requireSession, async (c) => {
      let id: RpcId = null;
      try {
        const req = parseEnvelope(await c.req.text());
        id = req.id;
        if (requestedVersion(c) !== PROTOCOL_VERSION) {
          throw new RpcError(ErrorCode.versionNotSupported, `A2A version not supported; send A2A-Version: ${PROTOCOL_VERSION}`);
        }
        const unsupported = UNSUPPORTED[req.method];
        if (unsupported) throw unsupported;
        const handler = Object.hasOwn(METHODS, req.method) ? METHODS[req.method] : undefined;
        if (!handler) throw new RpcError(ErrorCode.methodNotFound, "Method not found");
        const result = await handler({ req, userId: c.get("sessionId"), directory: makeDirectory(c.env), env: c.env });
        return c.json(rpcResult(id, result));
      } catch (err) {
        if (err instanceof RpcError) return c.json(rpcError(id, err), err.httpStatus);
        console.error("a2a: internal error", err);
        return c.json(rpcError(id, new RpcError(ErrorCode.internal, "Internal error")));
      }
    });
}
