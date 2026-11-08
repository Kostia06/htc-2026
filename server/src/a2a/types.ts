// A2A protocol v1.0.0 (https://a2a-protocol.org/latest/specification/), JSON-RPC binding only.
// Only the fields Skillit sends or reads are modelled.

export const PROTOCOL_VERSION = "1.0";

export type Part = { text: string } | { data: unknown; mediaType?: string };

export type Message = {
  messageId: string;
  role: "ROLE_USER" | "ROLE_AGENT";
  parts: Part[];
  contextId?: string;
  taskId?: string;
};

export type TaskState = "TASK_STATE_WORKING" | "TASK_STATE_COMPLETED" | "TASK_STATE_FAILED";

export type Artifact = { artifactId: string; name?: string; parts: Part[] };

export type Task = {
  id: string;
  contextId: string;
  status: { state: TaskState; message?: Message };
  artifacts?: Artifact[];
};

export type A2ASkill = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
  inputModes: string[];
  outputModes: string[];
};

export type A2AAgentCard = {
  name: string;
  description: string;
  version: string;
  supportedInterfaces: { url: string; protocolBinding: "JSONRPC"; protocolVersion: string }[];
  capabilities: { streaming: boolean; pushNotifications: boolean; extendedAgentCard: boolean };
  securitySchemes: { bearer: { httpAuthSecurityScheme: { scheme: "Bearer"; description: string } } };
  securityRequirements: { schemes: { bearer: { list: string[] } } }[];
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: A2ASkill[];
};

export const ErrorCode = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  // JSON-RPC's implementation-defined server range; A2A reserves -32001..-32099 and has no rate-limit error
  rateLimited: -32000,
  taskNotFound: -32001,
  taskNotCancelable: -32002,
  pushNotSupported: -32003,
  unsupportedOperation: -32004,
  extendedCardNotConfigured: -32007,
  versionNotSupported: -32009,
} as const;
