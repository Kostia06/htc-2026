import type { Env } from "../../env";
import { sha256 } from "../../lib/hash";

// Composio is told a stable pseudonym, never our account id: on its side the connection can't be tied back to a person
export async function composioUserId(env: Env, userId: string) {
  return `skillit_${(await sha256(`${env.MEMORY_SECRET}:composio:${userId}`)).slice(0, 32)}`;
}
