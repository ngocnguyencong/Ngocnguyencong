import "server-only";

import { Buffer } from "node:buffer";

import {
  createToolRegistry,
  DEFAULT_AGENT_MAX_STEPS,
  type AgentRunResult,
  type AgentRunner,
  type ToolDefinition,
  type ToolScope,
} from "@supastack/agents";
import {
  calculateModelCost,
  throwIfAborted,
  WorkspaceBudgetExceededError,
  type AvailableModel,
  type TokenUsage,
  type WorkspaceAiContext,
} from "@supastack/ai";
import type {
  AiProviderAttemptAuthorization,
  AiUsageRecord,
  AuthorizeAiProviderAttemptInput,
  MarkTaskRunFailedInput,
  PersistTaskResultInput,
  RecordTaskRunInput,
  SettleAiBudgetReservationInput,
} from "@supastack/db";

import {
  AiProviderAttemptAuthorizationError,
  estimateConservativeUsage,
  safeTokenNumber,
} from "./ai-task-executor";

/** The requested catalog model is disabled or does not exist for the configured provider. */
export class AgentModelNotFoundError extends Error {
  constructor(modelId: string) {
    super(`The agent model "${modelId}" is not enabled in the model catalog.`);
    this.name = "AgentModelNotFoundError";
  }
}

/** The requested catalog model exists but cannot run the requested capability. */
export class AgentModelCapabilityError extends Error {
  constructor(modelId: string, capability: string) {
    super(`The agent model "${modelId}" does not support ${capability}.`);
    this.name = "AgentModelCapabilityError";
  }
}

/**
 * Agent runs bill the platform provider key — `createWorkspaceAgentRunner`
 * builds models from the server config and has no per-workspace key
 * resolver. A BYOK workspace would authorize hold-free while still
 * spending the platform key, so it fails closed until agent runtimes can
 * resolve workspace keys.
 */
export class AgentByokUnsupportedError extends Error {
  constructor() {
    super("Agent runs bill the platform provider key; workspace-managed keys are not supported.");
    this.name = "AgentByokUnsupportedError";
  }
}

const DEFAULT_AGENT_INSTRUCTIONS =
  "You are a workspace assistant. Use the available workspace tools to answer the request.";

interface AgentBudgetRepositories {
  appendAiUsage(input: AiUsageRecord): Promise<unknown>;
  authorizeAiProviderAttempt(
    input: AuthorizeAiProviderAttemptInput,
  ): Promise<AiProviderAttemptAuthorization>;
  markTaskRunFailed(input: MarkTaskRunFailedInput): Promise<unknown>;
  persistTaskResult(input: PersistTaskResultInput): Promise<{ status: string } | null>;
  recordTaskRun(input: RecordTaskRunInput): Promise<unknown>;
  settleAiBudgetReservation(input: SettleAiBudgetReservationInput): Promise<unknown>;
}

export interface AgentBudgetDependencies {
  /** Production wiring binds this to `createWorkspaceAgentRunner` — receives the provider model name (`AvailableModel.model`), not the catalog id. */
  createRunner(providerModel: string): Promise<AgentRunner>;
  createTaskId(): string;
  /** Resolves the enabled catalog model + price for `modelId`, or null when unavailable. */
  findModel(modelId: string): Promise<AvailableModel | null>;
  now(): Date;
  repositories: AgentBudgetRepositories;
  resolveWorkspaceAiContext(workspaceId: string): Promise<WorkspaceAiContext>;
  /** Shared workspace tool set — filtered down to the caller's scopes before the run. */
  tools: readonly ToolDefinition[];
}

export interface BudgetedAgentRunInput {
  instructions?: string;
  maxSteps?: number;
  /** Catalog `ai_model.id` — NOT the provider model name (e.g. "gpt-4o"); those resolve through `findModel`. */
  modelId: string;
  prompt: string;
  /**
   * Tool scopes the run may exercise — derive these from the CALLER'S own
   * authorization (API-key scopes, session role), never from request
   * bodies or model output. The runtime cannot verify scopes ⊆ authorized.
   */
  scopes: readonly ToolScope[];
  signal?: AbortSignal;
  userId: string;
  workspaceId: string;
}

export interface BudgetedAgentRunResult {
  readonly costMicrounits: bigint;
  readonly result: AgentRunResult;
  readonly taskId: string;
  readonly usage: Readonly<{ inputTokens: bigint; outputTokens: bigint }>;
}

/**
 * Runs a framework agent inside the ModelRouter budget: the workspace's
 * task ledger records the run, a `maxSteps`-scaled estimate is reserved
 * through `authorizeAiProviderAttempt` before the adapter (and any provider
 * call) starts, actual token usage is appended to `ai_usage`, the hold
 * settles at real cost, and the result persists on the task row. Tool
 * context is injected from the caller — never from model output.
 */
export async function runBudgetedAgent(
  input: BudgetedAgentRunInput,
  dependencies: AgentBudgetDependencies,
): Promise<BudgetedAgentRunResult> {
  throwIfAborted(input.signal);
  const maxSteps = resolveMaxSteps(input.maxSteps);
  const workspace = await dependencies.resolveWorkspaceAiContext(input.workspaceId);
  throwIfAborted(input.signal);
  if (workspace.workspaceId !== input.workspaceId) {
    throw new Error("The agent workspace context is invalid.");
  }
  // BYOK authorizes hold-free yet the runner bills the platform key —
  // reject until agent runtimes resolve per-workspace provider keys.
  if (workspace.keyMode === "byok") {
    throw new AgentByokUnsupportedError();
  }
  const model = await dependencies.findModel(input.modelId);
  if (model === null) {
    throw new AgentModelNotFoundError(input.modelId);
  }
  if (input.scopes.length > 0 && !model.capabilities.tools) {
    throw new AgentModelCapabilityError(input.modelId, "tools");
  }
  const taskId = dependencies.createTaskId();
  const startedAt = dependencies.now();
  // The reservation check requires an owned task_run row, so the ledger
  // entry exists before any budget is held.
  await dependencies.repositories.recordTaskRun({
    id: taskId,
    input: { source: "agent-run" },
    status: "running",
    taskName: "agent.run",
    workspaceId: input.workspaceId,
  });

  // A multi-step run can consume the single-turn estimate once per step, so
  // the hold covers the worst case before the framework adapter starts.
  const instructions = input.instructions ?? DEFAULT_AGENT_INSTRUCTIONS;
  const estimatedUsage = estimateAgentRunUsage(input.prompt, instructions, maxSteps);
  const estimatedCostMicrounits = calculateModelCost(
    model.price,
    estimatedUsage,
  ).totalCostMicrounits;

  let holdId: string | null = null;
  let holdSettled = false;
  let result: AgentRunResult | undefined;
  const settle = async (reservationId: string, cost: bigint) => {
    await dependencies.repositories.settleAiBudgetReservation({
      actualCostMicrounits: cost,
      reservationId,
      settledAt: dependencies.now(),
      taskId,
      workspaceId: input.workspaceId,
    });
    holdSettled = true;
  };

  try {
    const authorization = await dependencies.repositories.authorizeAiProviderAttempt({
      estimatedUsageMicrounits: estimatedCostMicrounits,
      reservationId: `ai_budget:${taskId}:agent`,
      reservedAt: dependencies.now(),
      taskId,
      workspaceId: input.workspaceId,
    });
    if (authorization.status === "budget_exceeded") {
      throw new WorkspaceBudgetExceededError(input.workspaceId);
    }
    if (authorization.status !== "authorized") {
      throw new AiProviderAttemptAuthorizationError();
    }
    // Defensive: an authorized attempt may still carry no hold when the
    // workspace's effective monthly budget is unlimited.
    holdId = authorization.reservationId;

    const runner = await dependencies.createRunner(model.model);
    const tools = createToolRegistry(dependencies.tools).forScopes(input.scopes);
    result = await runner.run({
      context: Object.freeze({
        scopes: [...input.scopes],
        userId: input.userId,
        workspaceId: input.workspaceId,
      }),
      instructions,
      maxSteps,
      prompt: input.prompt,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      tools,
    });

    // Some adapters cannot report token totals for a multi-step run; the
    // hold then settles at the full estimate (conservative — the run did
    // happen) while the usage row records zeroed token counters so the
    // ledger still shows the reserved spend against real activity.
    const usage =
      result.usage === undefined
        ? { inputTokens: 0n, outputTokens: 0n }
        : {
            inputTokens: BigInt(result.usage.inputTokens),
            outputTokens: BigInt(result.usage.outputTokens),
          };
    const costMicrounits =
      result.usage === undefined
        ? estimatedCostMicrounits
        : calculateModelCost(model.price, usage).totalCostMicrounits;

    await dependencies.repositories.appendAiUsage({
      cachedInputTokens: 0,
      costMicrounits,
      createdAt: startedAt,
      id: `usage_${taskId}`,
      inputTokens: safeTokenNumber(usage.inputTokens),
      latencyMs: Math.max(0, dependencies.now().getTime() - startedAt.getTime()),
      model: model.model,
      outputTokens: safeTokenNumber(usage.outputTokens),
      priceId: model.price.priceId,
      provider: model.provider,
      requestId: taskId,
      status: "completed",
      workspaceId: input.workspaceId,
    });
    if (holdId !== null) await settle(holdId, costMicrounits);
    const persisted = await dependencies.repositories.persistTaskResult({
      completedAt: dependencies.now(),
      result: {
        model: { id: model.id, model: model.model, provider: model.provider },
        source: "agent-run",
        text: result.text,
        toolCallCount: result.toolCalls.length,
        toolNames: [...new Set(result.toolCalls.map((call) => call.name))],
      },
      taskId,
      workspaceId: input.workspaceId,
    });
    if (persisted?.status !== "completed") {
      throw new Error("The agent run result could not be persisted.");
    }
    return Object.freeze({ costMicrounits, result, taskId, usage });
  } catch (error) {
    // A finished run may have incurred provider cost even if writing usage
    // failed — keep its hold reserved until the period ends; an unfinished
    // run releases the hold at zero.
    if (holdId !== null && !holdSettled && result === undefined) {
      await settle(holdId, 0n).catch(() => undefined);
    }
    await dependencies.repositories
      .markTaskRunFailed({
        completedAt: dependencies.now(),
        errorCode: "agent_run_failed",
        taskId,
        workspaceId: input.workspaceId,
      })
      .catch(() => undefined);
    throw error;
  }
}

function resolveMaxSteps(maxSteps: number | undefined): number {
  if (maxSteps === undefined) return DEFAULT_AGENT_MAX_STEPS;
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) {
    throw new Error("A positive integer maxSteps is required.");
  }
  return maxSteps;
}

function estimateAgentRunUsage(prompt: string, instructions: string, maxSteps: number): TokenUsage {
  const base = estimateConservativeUsage(prompt);
  const steps = BigInt(maxSteps);
  return Object.freeze({
    cachedInputTokens: 0n,
    inputTokens: (base.inputTokens + BigInt(Buffer.byteLength(instructions, "utf8"))) * steps,
    outputTokens: base.outputTokens * steps,
  });
}
