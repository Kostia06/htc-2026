import type { Env } from "../../env";
import type { PrivateMemoryPort } from "./types";

// the encrypted per-user store is built separately; its port is bound to one user so no tool can reach another's memory
export function memoryFor(_env: Env, _userId: string): PrivateMemoryPort {
  const notWired = async (): Promise<never> => {
    throw new Error("private memory not wired");
  };
  return { recall: notWired, remember: notWired };
}
