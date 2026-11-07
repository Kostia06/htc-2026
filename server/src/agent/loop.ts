import type { GeminiContent, GeminiPart } from "../ai/gemini";

export type Declaration = { name: string; description: string; parameters: Record<string, unknown> };
export type Tool = { declaration: Declaration; run: (args: Record<string, unknown>) => Promise<unknown> };
export type Model = (contents: GeminiContent[], declarations: Declaration[]) => Promise<GeminiContent>;

export async function runAgent(opts: { model: Model; tools: Record<string, Tool>; goal: string; maxSteps: number }) {
  const declarations = Object.values(opts.tools).map((t) => t.declaration);
  const contents: GeminiContent[] = [{ role: "user", parts: [{ text: opts.goal }] }];
  const toolCalls: { name: string; args: Record<string, unknown> }[] = [];

  for (let step = 0; step < opts.maxSteps; step++) {
    const reply = await opts.model(contents, declarations);
    contents.push(reply);
    const calls = reply.parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (calls.length === 0) {
      return { answer: reply.parts.map((p) => p.text ?? "").join("").trim(), toolCalls, stoppedEarly: false };
    }
    const responses: GeminiPart[] = [];
    for (const call of calls) {
      toolCalls.push(call);
      const tool = opts.tools[call.name];
      const response = tool
        ? await tool.run(call.args ?? {}).catch((e: Error) => ({ error: e.message }))
        : { error: `unknown tool ${call.name}` };
      responses.push({ functionResponse: { name: call.name, response } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { answer: "", toolCalls, stoppedEarly: true };
}
