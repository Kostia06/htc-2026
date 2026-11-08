import type { Tool } from "./loop";

// on top of the skill's maxSteps: one step can hold several calls, so steps alone don't bound cost
export const RUN_LIMITS = { totalCalls: 25, perTool: { fetch_page: 6, job_postings: 3, hn_search: 3, devto_search: 3 } as Record<string, number> };

export function withBudget(tools: Record<string, Tool>, limits = RUN_LIMITS): Record<string, Tool> {
  let total = 0;
  const perTool = new Map<string, number>();

  const limited = (name: string, tool: Tool): Tool => ({
    ...tool,
    run: async (args) => {
      if (tool.terminal) return tool.run(args);
      const used = perTool.get(name) ?? 0;
      if (total >= limits.totalCalls) return { error: "tool budget for this run is used up; call finish now" };
      if (used >= (limits.perTool[name] ?? Infinity)) return { error: `${name} limit of ${limits.perTool[name]} reached for this run` };
      total++;
      perTool.set(name, used + 1);
      return tool.run(args);
    },
  });

  return Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, limited(name, tool)]));
}
