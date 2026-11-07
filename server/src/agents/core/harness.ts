import type { Env } from "../../env";
import { schemaError } from "../../lib/json-schema";
import { scrubStrings } from "../../lib/scrub";
import { finishTool } from "../shared-tools/finish";
import { withBudget } from "./budget";
import { runAgent, type Tool, type ToolCallRecord } from "./loop";
import { systemPrompt } from "./prompt";
import { recordRunDone, recordRunFailed, recordRunStart } from "./runs";
import type { AgentDeps, CompanyRef, PrivateMemoryPort, RunRequest, RunResult, Skill, ToolContext, ToolDefinition, Toolbox } from "./types";

const PERSONAL_CONTEXT_LIMIT = 8;

// the request can't run (bad platform, input or company, or on cooldown); nothing was run or recorded
export class RunRejected extends Error {
  readonly status: 400 | 404 | 429;
  constructor(message: string, status: 400 | 404 | 429) {
    super(message);
    this.status = status;
  }
}

const noPrivateAccess = async (): Promise<never> => {
  throw new Error("this skill has no access to private memory");
};

const NO_MEMORY: PrivateMemoryPort = {
  recall: async () => [],
  remember: noPrivateAccess,
  profile: noPrivateAccess,
  updateProfile: noPrivateAccess,
};

// validates and records the run, then hands back its result as a promise so callers can wait or not
export async function startSkill(deps: AgentDeps, request: RunRequest) {
  const { skill, platform, userId, input } = request;
  if (!skill.platforms.includes(platform)) throw new RunRejected(`${skill.name} does not run on ${platform}`, 400);
  const inputError = schemaError(skill.inputSchema, input);
  if (inputError) throw new RunRejected(inputError, 400);
  const company = await resolveCompany(deps.env, input);
  if (skill.claim && !(await skill.claim(input, deps.services))) throw new RunRejected(`${skill.name} ran recently, try again later`, 429);

  const runId = await recordRunStart(deps.env, { userId, skill: skill.name, platform });
  return { runId, result: execute(deps, request, runId, company) };
}

export async function runSkill(deps: AgentDeps, request: RunRequest): Promise<RunResult> {
  return (await startSkill(deps, request)).result;
}

async function execute(deps: AgentDeps, request: RunRequest, runId: string, company?: CompanyRef): Promise<RunResult> {
  const { skill, platform, userId, input } = request;
  try {
    const memory = skill.personal ? deps.memoryFor(userId) : NO_MEMORY;
    const memories = skill.personal ? await memory.recall({ limit: PERSONAL_CONTEXT_LIMIT }) : null;
    const ctx: ToolContext = {
      env: deps.env,
      userId,
      company,
      platform,
      fetchedPages: new Set(),
      triedPages: new Set(),
      memory,
      services: deps.services,
      groundingText: skill.groundingText?.(input),
    };

    const run = await runAgent({
      model: deps.model(systemPrompt(skill, platform, memories)),
      tools: bindTools(skill, request.tools, ctx),
      goal: skill.buildGoal(input, ctx),
      maxSteps: skill.maxSteps,
    });
    if (!run.output) {
      const reason = run.stoppedEarly ? `did not call finish within ${skill.maxSteps} steps` : "stopped without calling finish";
      return fail(deps.env, runId, `the agent ${reason}`, run.toolCalls);
    }

    const output = scrubStrings(skill.finalize?.(run.output, run.toolCalls) ?? run.output);
    await recordRunDone(deps.env, runId, output);
    return { runId, status: "done", output, toolCalls: run.toolCalls };
  } catch (e) {
    return fail(deps.env, runId, (e as Error).message, []);
  }
}

async function fail(env: Env, runId: string, error: string, toolCalls: ToolCallRecord[]): Promise<RunResult> {
  await recordRunFailed(env, runId, error);
  return { runId, status: "failed", error, toolCalls };
}

async function resolveCompany(env: Env, input: unknown): Promise<CompanyRef | undefined> {
  const slug = (input as { company?: unknown }).company;
  if (typeof slug !== "string") return undefined;
  const company = await env.DB.prepare("SELECT id, slug, name, website FROM companies WHERE slug = ?").bind(slug).first<CompanyRef>();
  if (!company) throw new RunRejected(`unknown company ${slug}`, 404);
  return company;
}

function fromToolbox(tools: Toolbox, name: string) {
  if (!Object.hasOwn(tools, name)) throw new Error(`skill uses ${name}, which its agent does not hold`);
  return tools[name];
}

// the model sees only what the skill allows, each tool bound to this run's context
function bindTools(skill: Skill, tools: Toolbox, ctx: ToolContext): Record<string, Tool> {
  const definitions: ToolDefinition[] = [...skill.tools.map((name) => fromToolbox(tools, name)), finishTool(skill.outputSchema)];
  const bound = definitions.map((d): [string, Tool] => [
    d.name,
    {
      declaration: { name: d.name, description: d.description, parameters: d.parameters },
      terminal: d.terminal,
      run: (args) => d.run(args, ctx),
    },
  ]);
  return withBudget(Object.fromEntries(bound));
}
