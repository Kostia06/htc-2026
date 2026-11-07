import type { GeminiContent, GeminiPart } from "../../integrations/gemini";

export type Declaration = { name: string; description: string; parameters: Record<string, unknown> };
export type Tool = {
  declaration: Declaration;
  // a terminal tool ends the run once it accepts its arguments; those arguments become the output
  terminal?: boolean;
  run: (args: Record<string, unknown>) => Promise<unknown>;
};
export type Model = (contents: GeminiContent[], declarations: Declaration[]) => Promise<GeminiContent>;
export type ToolCallRecord = { name: string; args: Record<string, unknown>; result: unknown };

export const MAX_CALLS_PER_STEP = 4;

const isError = (result: unknown) => typeof result === "object" && result !== null && "error" in result;

export async function runAgent(opts: { model: Model; tools: Record<string, Tool>; goal: string; maxSteps: number }) {
  const declarations = Object.values(opts.tools).map((t) => t.declaration);
  const contents: GeminiContent[] = [{ role: "user", parts: [{ text: opts.goal }] }];
  const toolCalls: ToolCallRecord[] = [];

  for (let step = 0; step < opts.maxSteps; step++) {
    const reply = await opts.model(contents, declarations);
    contents.push(reply);
    const calls = reply.parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (calls.length === 0) {
      return { answer: reply.parts.map((p) => p.text ?? "").join("").trim(), toolCalls, stoppedEarly: false };
    }
    const responses: GeminiPart[] = [];
    for (const [i, call] of calls.entries()) {
      const tool = opts.tools[call.name];
      const args = call.args ?? {};
      const response =
        i >= MAX_CALLS_PER_STEP
          ? { error: `too many tool calls in one step, max ${MAX_CALLS_PER_STEP}` }
          : tool
            ? await tool.run(args).catch((e: Error) => ({ error: e.message }))
            : { error: `unknown tool ${call.name}` };
      if (i < MAX_CALLS_PER_STEP) toolCalls.push({ name: call.name, args, result: response });
      if (tool?.terminal && i < MAX_CALLS_PER_STEP && !isError(response)) {
        return { answer: "", toolCalls, stoppedEarly: false, output: args };
      }
      responses.push({ functionResponse: { name: call.name, response } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { answer: "", toolCalls, stoppedEarly: true };
}
