import type { AgentCard, AgentDirectory, DirectoryRun } from "../../src/a2a/directory";

export const cards: AgentCard[] = [
  {
    name: "resume",
    description: "Resume agent",
    skills: [
      { id: "tailor-resume", name: "Tailor resume", description: "Tailors a resume to a job.", platforms: ["app"], inputSchema: { type: "object", properties: { jobId: { type: "string" } } } },
    ],
  },
  {
    name: "research",
    description: "Research agent",
    skills: [{ id: "research-company", name: "Research company", description: "Researches a company.", platforms: ["app", "background"], inputSchema: { type: "object" } }],
  },
];

type StoredRun = { userId: string; run: DirectoryRun | { status: "running"; runId: string } };

export function fakeDirectory() {
  const runs = new Map<string, StoredRun>();
  const calls: { skillId: string; userId: string; input: unknown }[] = [];
  let next = 0;
  let outcome: "done" | "failed" | "throw" = "done";

  const directory: AgentDirectory = {
    cards: () => cards,
    async run(req) {
      calls.push(req);
      if (outcome === "throw") throw new Error("model exploded with secret details");
      const runId = `run-${++next}`;
      const run: DirectoryRun = outcome === "done" ? { status: "done", runId, output: { echo: req.input } } : { status: "failed", runId, error: "skill failed" };
      runs.set(runId, { userId: req.userId, run });
      return run;
    },
    async findRun(runId, userId) {
      const stored = runs.get(runId);
      return stored && stored.userId === userId ? stored.run : null;
    },
  };

  return {
    directory,
    calls,
    failNext: () => (outcome = "failed"),
    throwNext: () => (outcome = "throw"),
    seedRunning: (runId: string, userId: string) => runs.set(runId, { userId, run: { status: "running", runId } }),
  };
}
