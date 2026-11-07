// What the A2A layer needs from Raven's agents; the orchestrator implements it at mount time.
export type AgentSkillCard = {
  id: string;
  name: string;
  description: string;
  platforms: ("app" | "vr" | "background")[];
  inputSchema: Record<string, unknown>;
};

export type AgentCard = { name: string; description: string; skills: AgentSkillCard[] };

export type DirectoryRun =
  | { status: "done"; runId: string; output: Record<string, unknown> }
  | { status: "failed"; runId: string; error: string };

export type AgentDirectory = {
  cards(): AgentCard[];
  run(req: { skillId: string; userId: string; input: unknown }): Promise<DirectoryRun>;
  findRun(runId: string, userId: string): Promise<DirectoryRun | { status: "running"; runId: string } | null>;
};
