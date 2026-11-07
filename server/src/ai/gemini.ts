import type { Env } from "../env";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiPart = { text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } };
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export async function generate(env: Env, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/${env.GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
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
