import "server-only";

import { randomUUID } from "node:crypto";

import type { ToolDefinition } from "@supastack/agents";
import type { WorkspaceAiContext } from "@supastack/ai";
import { parseServerConfig } from "@supastack/config";
import {
  aiBudgetReservation,
  aiModel,
  aiModelPrice,
  aiUsage,
  canWriteWorkspace,
  createDrizzleRepositoryExecutor,
  createWorkspaceRepositories,
  effectiveAiMonthlyBudget,
  entitlement,
  normalizeWorkspaceRole,
  user,
  workspaceAiPolicy,
  workspaceMembership,
} from "@supastack/db";
import { and, eq, gt, gte, isNull, lt, lte, or } from "drizzle-orm";
import { TriggerWorkflowClient } from "@supastack/jobs";
import { isCorrelationId, newCorrelationId } from "@supastack/observability";
import { tasks } from "@trigger.dev/sdk";

import { database, getAuthSession } from "./auth-runtime";
import { runBudgetedAgent, type BudgetedAgentRunInput } from "./agent-budget";
import { createRuntimeModelRouter, toAvailableModels } from "./ai-model-catalog";
import { createAiTaskBff } from "./ai-task-bff";
import { createAiTaskSubmissionStore, readAiTaskSubmission } from "./ai-task-submission-store";
import {
  AiTaskExecutionError,
  PRODUCTION_AI_MAX_OUTPUT_TOKENS,
  createProductionAiTaskExecutor,
  parseTriggeredAiTaskPayload,
} from "./ai-task-executor";
import { createServerDrizzleProviderKeyResolver } from "./byok-key-vault";
import { completeBudgetedChat, type BudgetedChatInput } from "./chat-budget";
import { serverObservability } from "./observability-runtime";
import { consumeQuota, resolveEffectiveUsageLimit } from "./usage-quota";
import { aiTaskUserLimiter, aiTaskWorkspaceLimiter } from "./rate-limit-runtime";
import { createServerProviderComposition } from "./server-provider-composition";

const serverConfig = parseServerConfig();
const repositories = createWorkspaceRepositories(createDrizzleRepositoryExecutor(database));
const providerKeyResolver =
  serverConfig.providers.jobs.kind === "trigger"
    ? createServerDrizzleProviderKeyResolver({ database, serverConfig })
    : undefined;
const providers = createServerProviderComposition({
  openAiGenerationLimits: {
    maxOutputTokens: PRODUCTION_AI_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    timeoutMs: 120_000,
  },
  ...(providerKeyResolver ? { providerKeyResolver } : {}),
  serverConfig,
});
const triggerWorkflow =
  serverConfig.providers.jobs.kind === "trigger" ? new TriggerWorkflowClient({ tasks }) : undefined;

const router = createRuntimeModelRouter({
  aliasPolicy: serverConfig.aiRouting,
  provider: providers.ai,
  readModels: () => readCurrentModels(providers.ai.provider, new Date()),
});

/** Shared router + workspace context reused by the SSE chat stream endpoint. */
export function getChatStreamRuntime() {
  return {
    router,
    completeChat: (input: BudgetedChatInput) =>
      completeBudgetedChat(input, {
        createTaskId: () => `chat_${randomUUID()}`,
        now: () => new Date(),
        repositories,
        resolveWorkspaceAiContext,
        router,
      }),
  };
}

/**
 * The budgeted agent-run path for server-side callers (route handlers,
 * server actions, jobs). Agents still get no public endpoint — this is the
 * ModelRouter-budgeted way to run one: callers supply the shared workspace
 * tools bound to the caller's own headers (see `createWorkspaceTools`), and
 * the helper reserves the maxSteps-scaled estimate before the adapter runs.
 */
export function getAgentRunRuntime() {
  return {
    runAgent: (input: BudgetedAgentRunInput, tools: readonly ToolDefinition[]) =>
      runBudgetedAgent(input, {
        // Lazy import: agent-runtime composes the provider SDKs eagerly, so a
        // static import would pull them into every api-task-runtime consumer.
        createRunner: async (modelId) =>
          (await import("./agent-runtime")).createWorkspaceAgentRunner(serverConfig, modelId),
        createTaskId: () => `agent_${randomUUID()}`,
        findModel: async (modelId) =>
          (await readCurrentModels(providers.ai.provider, new Date(), modelId))[0] ?? null,
        now: () => new Date(),
        repositories,
        resolveWorkspaceAiContext,
        tools,
      }),
  };
}

/**
 * Metered key for AI task intake — the `usageLimits` entry products declare
 * per plan (e.g. `{ "ai.requests": 500 }`). Kit plans ship no keys, so the
 * quota seam stays dormant until a derived product configures limits.
 */
const AI_TASK_QUOTA_KEY = "ai.requests";

const executor = createProductionAiTaskExecutor({
  createId: (kind) => `${kind}_${randomUUID()}`,
  email: providers.email,
  emailProvider: serverConfig.providers.email.kind,
  now: () => new Date(),
  onBudgetExceeded: async (workspaceId) => {
    const { tryEmitProductNotification } = await import("./notification-runtime");
    await tryEmitProductNotification({ type: "ai.budget_exceeded", workspaceId });
  },
  onTaskCompleted: async ({ correlationId, taskId, workspaceId }) => {
    const { tryEmitWorkspaceEvent } = await import("./webhook-delivery");
    await tryEmitWorkspaceEvent({
      ...(correlationId === undefined ? {} : { correlationId }),
      data: { taskId },
      eventType: "ai.task_completed",
      workspaceId,
    });
  },
  repositories,
  resolveWorkspaceAiContext,
  router,
});

/** Null in local job mode prevents durable tasks from being stranded without a worker. */
export const productionAiTaskBff =
  serverConfig.providers.jobs.kind === "trigger"
    ? createAiTaskBff({
        appUrl: serverConfig.app.webUrl,
        checkSubmissionRate: async ({ userId, workspaceId }) => {
          const userLimit = await aiTaskUserLimiter.check(`user:${userId}`);
          if (!userLimit.allowed) return userLimit;
          return aiTaskWorkspaceLimiter.check(`workspace:${workspaceId}`);
        },
        createTaskId: () => `task_${randomUUID()}`,
        consumeTaskQuota: async ({ taskId, workspaceId }) => {
          // Dormant until a plan configures this meter or an owner sets a
          // cap: an unlimited effective limit skips the consume entirely —
          // no counter rows, no ledger writes, no behavior change.
          if ((await resolveEffectiveUsageLimit(workspaceId, AI_TASK_QUOTA_KEY)) === null) {
            return { allowed: true };
          }
          // Configured quota: `consumeQuota` debits a prepaid credit when the
          // plan's counter is exhausted (referenceId = taskId links the
          // ledger row to the action it paid for); an owner-set cap is a
          // hard ceiling and never draws credits.
          const consumed = await consumeQuota({
            key: AI_TASK_QUOTA_KEY,
            n: 1,
            referenceId: taskId,
            workspaceId,
          });
          return { allowed: consumed.ok };
        },
        enqueue: async ({ idempotencyKey, input, type, workspaceId }) => {
          if (triggerWorkflow === undefined) {
            throw new Error("Trigger workflow client is unavailable.");
          }
          const run = await triggerWorkflow.triggerWorkflow({
            options: { idempotencyKey },
            payload: { input, workspaceId },
            taskIdentifier: type,
          });
          return { id: run.id, status: "queued" as const };
        },
        findWorkspaceContext,
        getSession: getAuthSession,
        markTaskRunFailed: repositories.markTaskRunFailed,
        readTaskResult: repositories.readTaskResult,
        reportMetadataFailure: ({ correlationId, taskId, providerRunId, workspaceId }) => {
          serverObservability.captureException(
            new Error("AI task run metadata attachment failed"),
            {
              correlationId,
              operation: "ai.task.attachRun",
              taskId,
              providerRunId,
              workspaceId,
            },
          );
        },
        recordTaskRun: repositories.recordTaskRun,
        reserveTaskRun: createAiTaskSubmissionStore(database),
        readSubmission: (input) => readAiTaskSubmission(database, input),
        setTaskRunProviderRunId: repositories.setTaskRunProviderRunId,
        track: (event) => serverObservability.track(event),
      })
    : null;

/** Entry point used only by the concrete Trigger.dev task definition. */
export async function executeTriggeredAiTask(envelope: unknown) {
  const payload = parseTriggeredAiTaskPayload(envelope);
  // Rows enqueued before correlation existed carry no id — mint one at
  // execution start rather than failing a perfectly runnable task. A
  // malformed value mints fresh too: only a valid opaque id is propagated.
  const correlationId = isCorrelationId(payload.correlationId)
    ? payload.correlationId
    : newCorrelationId();
  return serverObservability.measure(
    "ai.task.execute",
    async () => {
      try {
        const result = await executor.run(payload);
        serverObservability.track({
          distinctId: payload.workspaceId,
          name: "ai_task_completed",
          properties: { correlationId, taskId: payload.taskId },
          workspaceId: payload.workspaceId,
        });
        return result;
      } catch (error) {
        try {
          serverObservability.captureException(asError(error), {
            correlationId,
            operation: "ai.task.execute",
            taskId: payload.taskId,
            workspaceId: payload.workspaceId,
          });
        } catch {
          // Observability must never replace the worker's safe public failure.
        }
        throw new AiTaskExecutionError();
      }
    },
    {
      correlationId,
      taskId: payload.taskId,
      workspaceId: payload.workspaceId,
    },
  );
}

export async function findWorkspaceContext(
  userId: string,
  workspaceId?: string,
  access: "read" | "write" = "read",
) {
  const [membership] = await database
    .select({
      email: user.email,
      role: workspaceMembership.role,
      workspaceId: workspaceMembership.workspaceId,
    })
    .from(workspaceMembership)
    .innerJoin(user, eq(user.id, workspaceMembership.userId))
    .where(
      workspaceId === undefined
        ? eq(workspaceMembership.userId, userId)
        : and(
            eq(workspaceMembership.userId, userId),
            eq(workspaceMembership.workspaceId, workspaceId),
          ),
    )
    .limit(1);
  if (
    membership === undefined ||
    (access === "write" && !canWriteWorkspace(normalizeWorkspaceRole(membership.role)))
  ) {
    return null;
  }

  const [activeEntitlement] = await database
    .select({ workspaceId: entitlement.workspaceId })
    .from(entitlement)
    .where(
      and(
        eq(entitlement.workspaceId, membership.workspaceId),
        eq(entitlement.key, "ai.reference-task"),
        or(eq(entitlement.status, "active"), eq(entitlement.status, "trialing")),
      ),
    )
    .limit(1);

  return {
    completionEmailTo: membership.email,
    hasAiEntitlement: activeEntitlement !== undefined,
    workspaceId: membership.workspaceId,
  };
}

async function resolveWorkspaceAiContext(workspaceId: string): Promise<WorkspaceAiContext> {
  const [policy] = await database
    .select({
      keyMode: workspaceAiPolicy.keyMode,
      monthlyBudgetMicrounits: workspaceAiPolicy.monthlyBudgetMicrounits,
    })
    .from(workspaceAiPolicy)
    .where(eq(workspaceAiPolicy.workspaceId, workspaceId))
    .limit(1);
  const keyMode = policy?.keyMode ?? "platform";
  if (keyMode !== "platform" && keyMode !== "byok") {
    throw new Error("The workspace AI key mode is invalid.");
  }

  let budget: WorkspaceAiContext["budget"] = null;
  const monthlyBudgetMicrounits = effectiveAiMonthlyBudget(policy);
  if (monthlyBudgetMicrounits !== null) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const spend = await database
      .select({ costMicrounits: aiUsage.costMicrounits })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.workspaceId, workspaceId),
          gte(aiUsage.createdAt, monthStart),
          // Same [periodStart, nextPeriodStart) window the authorization path
          // sums — a future-dated usage row must not inflate routing spend.
          lt(aiUsage.createdAt, nextMonthStart),
        ),
      );
    const held = await database
      .select({ reservedMicrounits: aiBudgetReservation.reservedMicrounits })
      .from(aiBudgetReservation)
      .where(
        and(
          eq(aiBudgetReservation.workspaceId, workspaceId),
          eq(aiBudgetReservation.periodStart, monthStart),
          eq(aiBudgetReservation.status, "reserved"),
        ),
      );
    budget = {
      limitMicrounits: monthlyBudgetMicrounits,
      spentMicrounits:
        spend.reduce((total, row) => total + row.costMicrounits, 0n) +
        held.reduce((total, row) => total + row.reservedMicrounits, 0n),
    };
  }

  return { budget, keyMode, workspaceId };
}

async function readCurrentModels(provider: string, now: Date, modelId?: string) {
  const records = await database
    .select({
      cachedInputMicrounitsPerMillion: aiModelPrice.cachedInputMicrounitsPerMillion,
      contextWindow: aiModel.contextWindow,
      currency: aiModelPrice.currency,
      effectiveFrom: aiModelPrice.effectiveFrom,
      effectiveTo: aiModelPrice.effectiveTo,
      inputMicrounitsPerMillion: aiModelPrice.inputMicrounitsPerMillion,
      isEnabled: aiModel.isEnabled,
      model: aiModel.model,
      modelId: aiModel.id,
      modelVersion: aiModel.modelVersion,
      outputMicrounitsPerMillion: aiModelPrice.outputMicrounitsPerMillion,
      priceId: aiModelPrice.id,
      provider: aiModel.provider,
      supportsStructuredOutput: aiModel.supportsStructuredOutput,
      supportsTools: aiModel.supportsTools,
      supportsVision: aiModel.supportsVision,
    })
    .from(aiModel)
    .innerJoin(aiModelPrice, eq(aiModelPrice.modelId, aiModel.id))
    .where(
      and(
        eq(aiModel.provider, provider),
        eq(aiModelPrice.provider, provider),
        eq(aiModel.isEnabled, true),
        lte(aiModelPrice.effectiveFrom, now),
        or(isNull(aiModelPrice.effectiveTo), gt(aiModelPrice.effectiveTo, now)),
        modelId === undefined ? undefined : eq(aiModel.id, modelId),
      ),
    );

  return toAvailableModels({ now, provider, records });
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Unknown AI task failure");
}

/** Only a non-empty, bounded opaque id is propagated — anything else mints fresh. */
