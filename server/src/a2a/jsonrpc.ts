import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ErrorCode } from "./types";

export type RpcId = string | number | null;
export type RpcRequest = { id: string | number; method: string; params: Record<string, unknown> };

export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown[],
    readonly httpStatus: ContentfulStatusCode = 200,
  ) {
    super(message);
  }
}

export const invalidParams = (field: string, description: string) =>
  new RpcError(ErrorCode.invalidParams, "Invalid parameters", [{ "@type": "type.googleapis.com/google.rpc.BadRequest", fieldViolations: [{ field, description }] }]);

export const taskNotFound = () => new RpcError(ErrorCode.taskNotFound, "Task not found");

export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

// batches and notifications are valid JSON-RPC but no A2A method uses them, so they are rejected rather than half-supported
export function parseEnvelope(raw: string): RpcRequest {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new RpcError(ErrorCode.parse, "Invalid JSON payload");
  }
  const id = isObject(body) ? body.id : undefined;
  const validId = typeof id === "string" || typeof id === "number";
  if (!isObject(body) || body.jsonrpc !== "2.0" || typeof body.method !== "string" || !validId) {
    throw new RpcError(ErrorCode.invalidRequest, "Request payload validation error");
  }
  if (body.params !== undefined && !isObject(body.params)) throw invalidParams("params", "params must be an object");
  return { id, method: body.method, params: body.params ?? {} };
}

export const rpcResult = (id: RpcId, result: unknown) => ({ jsonrpc: "2.0", id, result });

export const rpcError = (id: RpcId, err: RpcError) => ({
  jsonrpc: "2.0",
  id,
  error: { code: err.code, message: err.message, ...(err.data ? { data: err.data } : {}) },
});
