import type { Env } from "../env";

export async function embed(env: Env, text: string) {
  const out = (await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [text] })) as { data: number[][] };
  return out.data[0];
}
