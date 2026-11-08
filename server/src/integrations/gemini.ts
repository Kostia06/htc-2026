import type { Env } from "../env";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiPart = { text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } };
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

// only an overload (503) is worth retrying on the same model: it clears in seconds.
// A spent quota (429) or a model too slow to answer will not, so those go straight to the fallback.
const OVERLOADED = 503;
const QUOTA_SPENT = 429;
const TIMED_OUT = 504;
export const retry = { delaysMs: [800, 2500], timeoutMs: 30_000 };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(env: Env, model: string, body: Record<string, unknown>): Promise<Response> {
  try {
    return await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(retry.timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") return new Response("request timed out", { status: TIMED_OUT });
    throw error;
  }
}

const isUnavailable = (res: Response) => [OVERLOADED, QUOTA_SPENT, TIMED_OUT].includes(res.status);

async function postWithRetries(env: Env, model: string, body: Record<string, unknown>) {
  let res = await post(env, model, body);
  for (const delay of retry.delaysMs) {
    if (res.status !== OVERLOADED) break;
    await pause(delay);
    res = await post(env, model, body);
  }
  return res;
}

export async function generate(env: Env, body: Record<string, unknown>) {
  let res = await postWithRetries(env, env.GEMINI_MODEL, body);
  // an unavailable main model should slow the demo down, not stop it
  if (isUnavailable(res) && env.GEMINI_FALLBACK_MODEL) res = await postWithRetries(env, env.GEMINI_FALLBACK_MODEL, body);
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json<{ candidates?: { content?: GeminiContent }[] }>();
  const content = json.candidates?.[0]?.content;
  if (!content) throw new Error("gemini returned no candidate");
  return content;
}

export async function generateJson<T>(env: Env, prompt: string, schema: object): Promise<T> {
  const content = await generate(env, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema },
  });
  const text = content.parts.map((p) => p.text ?? "").join("");
  return JSON.parse(text) as T;
}

// second privacy pass after the regex one: catches names we weren't told about
export async function scrubNames<T extends Record<string, string>>(env: Env, fields: T): Promise<T> {
  const keys = Object.keys(fields);
  const schema = { type: "object", properties: Object.fromEntries(keys.map((k) => [k, { type: "string" }])), required: keys };
  return generateJson<T>(
    env,
    "Replace every person's name in these fields with [name]. Keep company names, product names and everything else exactly as written. Return the same keys.\n\n" +
      JSON.stringify(fields),
    schema,
  );
}
