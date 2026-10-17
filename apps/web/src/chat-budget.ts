import "server-only";

import {
  calculateModelCost,
  WorkspaceBudgetExceededError,
  type AiExecutionResult,
  type ModelAlias,
  type ModelRequirements,
  type ModelRouter,
  type WorkspaceAiContext,
  throwIfAborted,
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

import { estimateConservativeUsage, safeTokenNumber } from "./ai-task-executor";

interface ChatBudgetRepositories {
  appendAiUsage(input: AiUsageRecord): Promise<unknown>;
  authorizeAiProviderAttempt(
    input: AuthorizeAiProviderAttemptInput,
  ): Promise<AiProviderAttemptAuthorization>;
  markTaskRunFailed(input: MarkTaskRunFailedInput): Promise<unknown>;
  persistTaskResult(input: PersistTaskResultInput): Promise<{ status: string } | null>;
  recordTaskRun(input: RecordTaskRunInput): Promise<unknown>;
  settleAiBudgetReservation(input: SettleAiBudgetReservationInput): Promise<unknown>;
}

export interface ChatBudgetDependencies {
  createTaskId(): string;
  now(): Date;
  repositories: ChatBudgetRepositories;
  resolveWorkspaceAiContext(workspaceId: string): Promise<WorkspaceAiContext>;
  router: Pick<ModelRouter, "complete">;
}

export interface BudgetedChatInput {
  alias: ModelAlias;
  prompt: string;
  requirements: ModelRequirements;
  signal?: AbortSignal;
  workspaceId: string;
}

/** Reserve platform spend before every synchronous chat provider attempt. */
export async function completeBudgetedChat(
  input: BudgetedChatInput,
  dependencies: ChatBudgetDependencies,
): Promise<AiExecutionResult> {
  throwIfAborted(input.signal);
  const workspace = await dependencies.resolveWorkspaceAiContext(input.workspaceId);
  throwIfAborted(input.signal);
  if (workspace.workspaceId !== input.workspaceId) {
    throw new Error("The chat workspace context is invalid.");
  }
  const taskId = dependencies.createTaskId();
  const startedAt = dependencies.now();
  await dependencies.repositories.recordTaskRun({
    id: taskId,
    input: { source: "chat-stream" },
    status: "running",
    taskName: "chat.stream",
    workspaceId: input.workspaceId,
  });

  const holds: string[] = [];
  const settled = new Set<string>();
  let winningHold: string | null = null;
  let completion: AiExecutionResult | undefined;
  const settle = async (reservationId: string, cost: bigint) => {
    await dependencies.repositories.settleAiBudgetReservation({
      actualCostMicrounits: cost,
      reservationId,
      settledAt: dependencies.now(),
      taskId,
      workspaceId: input.workspaceId,
    });
    settled.add(reservationId);
  };

  try {
    completion = await dependencies.router.complete(
      {
        alias: input.alias,
        estimatedUsage: estimateConservativeUsage(input.prompt),
        input: { prompt: input.prompt },
        requirements: input.requirements,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
        workspace,
      },
      {
        beforeProviderAttempt: async (attempt) => {
          if (attempt.estimatedUsage === undefined) {
            throw new Error("The chat cost estimate is unavailable.");
          }
          const authorization = await dependencies.repositories.authorizeAiProviderAttempt({
            estimatedUsageMicrounits: calculateModelCost(
              attempt.model.price,
              attempt.estimatedUsage,
            ).totalCostMicrounits,
            reservationId: `ai_budget:${taskId}:${attempt.attemptNumber}`,
            reservedAt: dependencies.now(),
            taskId,
            workspaceId: input.workspaceId,
          });
          if (authorization.status === "budget_exceeded") {
            throw new WorkspaceBudgetExceededError(input.workspaceId);
          }
          if (authorization.status !== "authorized") {
            throw new Error("AI provider attempt is not authorized.");
          }
          winningHold = authorization.reservationId;
          if (winningHold !== null) holds.push(winningHold);
        },
      },
    );

    await dependencies.repositories.appendAiUsage({
      cachedInputTokens: safeTokenNumber(completion.usage.cachedInputTokens ?? 0n),
      costMicrounits: completion.usage.costMicrounits,
      createdAt: startedAt,
      id: `usage_${taskId}`,
      inputTokens: safeTokenNumber(completion.usage.inputTokens),
      latencyMs: Math.max(0, dependencies.now().getTime() - startedAt.getTime()),
      model: completion.model.model,
      outputTokens: safeTokenNumber(completion.usage.outputTokens),
      priceId: completion.usage.priceId,
      provider: completion.model.provider,
      requestId: taskId,
      status: "completed",
      workspaceId: input.workspaceId,
    });
    if (winningHold !== null) await settle(winningHold, completion.usage.costMicrounits);
    for (const hold of holds) {
      if (hold !== winningHold) await settle(hold, 0n).catch(() => undefined);
    }
    const persisted = await dependencies.repositories.persistTaskResult({
      completedAt: dependencies.now(),
      result: { source: "chat-stream" },
      taskId,
      workspaceId: input.workspaceId,
    });
    if (persisted?.status !== "completed") {
      throw new Error("The chat completion could not be persisted.");
    }
    return completion;
  } catch (error) {
    for (const hold of holds) {
      // A successful provider call may have incurred cost even if writing
      // usage failed. Keep its hold reserved until the period ends.
      if (settled.has(hold) || (completion !== undefined && hold === winningHold)) continue;
      await settle(hold, 0n).catch(() => undefined);
    }
    await dependencies.repositories
      .markTaskRunFailed({
        completedAt: dependencies.now(),
        errorCode: "chat_execution_failed",
        taskId,
        workspaceId: input.workspaceId,
      })
      .catch(() => undefined);
    throw error;
  }
}
