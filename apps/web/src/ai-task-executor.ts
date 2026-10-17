import { Buffer } from "node:buffer";

import type {
  AiExecutionResult,
  AiProviderAttemptHooks,
  ModelAlias,
  ModelRequirements,
  TokenUsage,
  WorkspaceAiContext,
} from "@supastack/ai";
import { calculateModelCost } from "@supastack/ai";
import type { EmailSender } from "@supastack/email";
import type {
  AiUsageRecord,
  AuthorizeAiProviderAttemptInput,
  MarkTaskRunFailedInput,
  MarkTaskRunRunningInput,
  PersistTaskResultInput,
  SettleAiBudgetReservationInput,
  TransactionalEmailDeliveryRecord,
} from "@supastack/db";
import { isCorrelationId } from "@supastack/observability";

export type ProductionAiTaskPayload = Readonly<{
  alias: ModelAlias;
  completionEmailTo: string;
  /**
   * Opaque `corr_<uuid>` minted at request intake — joins the task run's
   * observability emits back to the submitting request. Absent on rows
   * enqueued before correlation existed; execution mints a fresh one then.
   */
  correlationId?: string;
  prompt: string;
  requirements: ModelRequirements;
  taskId: string;
  workspaceId: string;
}>;

export class ProductionAiTaskPayloadError extends Error {
  constructor() {
    super("A valid workspace-scoped AI task payload is required.");
    this.name = "ProductionAiTaskPayloadError";
  }
}

export class AiProviderAttemptAuthorizationError extends Error {
  constructor() {
    super("AI provider attempt is not authorized.");
    this.name = "AiProviderAttemptAuthorizationError";
  }
}

export class AiTaskExecutionError extends Error {
  constructor() {
    super("AI task execution failed.");
    this.name = "AiTaskExecutionError";
  }
}

export const PRODUCTION_AI_MAX_OUTPUT_TOKENS = 8_192;
const ESTIMATED_INPUT_OVERHEAD_TOKENS = 4_096n;
const ESTIMATED_OUTPUT_TOKENS = BigInt(PRODUCTION_AI_MAX_OUTPUT_TOKENS);
const POSTGRES_INTEGER_MAX = 2_147_483_647n;

type ExecutorRepositories = Readonly<{
  appendAiUsage(input: AiUsageRecord): Promise<unknown>;
  listTransactionalEmailDeliveries(
    input: Readonly<{ workspaceId: string }>,
  ): Promise<TransactionalEmailDeliveryRecord[]>;
  authorizeAiProviderAttempt(
    input: AuthorizeAiProviderAttemptInput,
  ): Promise<Readonly<{ reservationId: string | null; status: string }>>;
  markTaskRunFailed(input: MarkTaskRunFailedInput): Promise<unknown>;
  markTaskRunRunning(input: MarkTaskRunRunningInput): Promise<Readonly<{ status: string }> | null>;
  persistTaskResult(input: PersistTaskResultInput): Promise<Readonly<{ status: string }> | null>;
  readTaskResult?(
    input: Readonly<{ taskId: string; workspaceId: string }>,
  ): Promise<Readonly<{ status: string }> | null>;
  recordTransactionalEmailDelivery(input: TransactionalEmailDeliveryRecord): Promise<unknown>;
  settleAiBudgetReservation(input: SettleAiBudgetReservationInput): Promise<unknown>;
}>;

export interface ProductionAiTaskExecutorDependencies {
  createId(kind: string): string;
  email: EmailSender;
  emailProvider: string;
  now(): Date;
  /** Optional in-app notification when monthly AI budget blocks an attempt. */
  onBudgetExceeded?(workspaceId: string): Promise<void>;
  /** Optional webhook fan-out after a task persists its completed result. */
  onTaskCompleted?(
    input: Readonly<{ correlationId?: string; taskId: string; workspaceId: string }>,
  ): Promise<void>;
  repositories: ExecutorRepositories;
  resolveWorkspaceAiContext?(workspaceId: string): Promise<WorkspaceAiContext>;
  router: Readonly<{
    complete(
      input: Readonly<{
        alias: ModelAlias;
        estimatedUsage?: TokenUsage;
        input: unknown;
        requirements: ModelRequirements;
        workspace: WorkspaceAiContext;
      }>,
      hooks?: AiProviderAttemptHooks,
    ): Promise<AiExecutionResult>;
  }>;
}

export function createProductionAiTaskExecutor(dependencies: ProductionAiTaskExecutorDependencies) {
  return Object.freeze({
    async run(rawPayload: unknown) {
      const payload = requirePayload(rawPayload);
      let existing: Readonly<{ status: string }> | null | undefined;
      try {
        existing = await dependencies.repositories.readTaskResult?.({
          taskId: payload.taskId,
          workspaceId: payload.workspaceId,
        });
      } catch {
        throw new AiTaskExecutionError();
      }
      if (existing?.status === "completed") {
        try {
          return await completeNotification(payload, dependencies);
        } catch {
          throw new AiTaskExecutionError();
        }
      }
      const startedAt = dependencies.now();
      let claim: Readonly<{ status: string }> | null;
      try {
        claim = await dependencies.repositories.markTaskRunRunning({
          startedAt,
          taskId: payload.taskId,
          workspaceId: payload.workspaceId,
        });
      } catch {
        throw new AiTaskExecutionError();
      }
      if (claim?.status !== "running") {
        throw new AiTaskExecutionError();
      }

      let taskCompleted = false;
      const authorizedReservationIds: string[] = [];
      const settledReservationIds = new Set<string>();
      let appendedUsageCostMicrounits: bigint | null = null;
      let successfulReservationId: string | null = null;
      let successfulReservationAt: Date | null = null;
      const releaseReservation = async (
        reservationId: string,
        actualCostMicrounits: bigint,
        settledAt: Date,
      ) => {
        if (settledReservationIds.has(reservationId)) {
          return;
        }
        try {
          // A 0n settle is the release path: it flips the row off "reserved"
          // so the hold stops counting toward the workspace's monthly budget.
          await dependencies.repositories.settleAiBudgetReservation({
            actualCostMicrounits,
            reservationId,
            settledAt,
            taskId: payload.taskId,
            workspaceId: payload.workspaceId,
          });
          settledReservationIds.add(reservationId);
        } catch {
          // Best-effort: a release failure must never mask the run's own error.
        }
      };
      try {
        // Per-run nonce: defense-in-depth so a future re-queued retry can
        // never collide on reservation ids already settled by an earlier run.
        const runNonce = dependencies.createId("run");
        const workspace = dependencies.resolveWorkspaceAiContext
          ? await dependencies.resolveWorkspaceAiContext(payload.workspaceId)
          : { budget: null, keyMode: "platform" as const, workspaceId: payload.workspaceId };
        if (workspace.workspaceId !== payload.workspaceId) {
          throw new ProductionAiTaskPayloadError();
        }

        const estimatedUsage = estimateConservativeUsage(payload.prompt);

        const completion = await dependencies.router.complete(
          {
            alias: payload.alias,
            estimatedUsage,
            input: { prompt: payload.prompt },
            requirements: payload.requirements,
            workspace,
          },
          {
            beforeProviderAttempt: async (attempt) => {
              if (attempt.estimatedUsage === undefined) {
                throw new AiProviderAttemptAuthorizationError();
              }
              const reservedAt = dependencies.now();
              const authorization = await dependencies.repositories.authorizeAiProviderAttempt({
                estimatedUsageMicrounits: calculateModelCost(
                  attempt.model.price,
                  attempt.estimatedUsage,
                ).totalCostMicrounits,
                reservationId: `ai_budget:${payload.taskId}:${runNonce}:${attempt.attemptNumber}`,
                reservedAt,
                taskId: payload.taskId,
                workspaceId: payload.workspaceId,
              });
              if (authorization.status !== "authorized") {
                if (authorization.status === "budget_exceeded") {
                  try {
                    await dependencies.onBudgetExceeded?.(payload.workspaceId);
                  } catch {
                    // Prefer failing the attempt over aborting on notification errors.
                  }
                }
                throw new AiProviderAttemptAuthorizationError();
              }
              successfulReservationId = authorization.reservationId;
              successfulReservationAt = reservedAt;
              if (authorization.reservationId !== null) {
                authorizedReservationIds.push(authorization.reservationId);
              }
            },
          },
        );

        if (successfulReservationAt === null) {
          throw new AiProviderAttemptAuthorizationError();
        }
        const completedAt = dependencies.now();
        const cachedInputTokens = completion.usage.cachedInputTokens ?? 0n;
        await dependencies.repositories.appendAiUsage({
          cachedInputTokens: safeTokenNumber(cachedInputTokens),
          costMicrounits: completion.usage.costMicrounits,
          createdAt: successfulReservationAt,
          id: `usage_${payload.taskId}`,
          inputTokens: safeTokenNumber(completion.usage.inputTokens),
          latencyMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
          model: completion.model.model,
          outputTokens: safeTokenNumber(completion.usage.outputTokens),
          priceId: completion.usage.priceId,
          provider: completion.model.provider,
          requestId: payload.taskId,
          status: "completed",
          workspaceId: payload.workspaceId,
        });
        appendedUsageCostMicrounits = completion.usage.costMicrounits;
        if (successfulReservationId !== null) {
          await dependencies.repositories.settleAiBudgetReservation({
            actualCostMicrounits: completion.usage.costMicrounits,
            reservationId: successfulReservationId,
            settledAt: completedAt,
            taskId: payload.taskId,
            workspaceId: payload.workspaceId,
          });
          settledReservationIds.add(successfulReservationId);
        }
        // Holds from earlier failed attempts are still "reserved" — release
        // them so a retried route cannot leak monthly budget.
        for (const reservationId of authorizedReservationIds) {
          await releaseReservation(reservationId, 0n, completedAt);
        }
        const persisted = await dependencies.repositories.persistTaskResult({
          completedAt,
          result: {
            model: {
              id: completion.model.id,
              model: completion.model.model,
              modelVersion: completion.model.modelVersion,
              provider: completion.model.provider,
            },
            text: completion.text,
            usage: {
              cachedInputTokens: safeTokenNumber(cachedInputTokens),
              costMicrounits: completion.usage.costMicrounits.toString(),
              inputTokens: safeTokenNumber(completion.usage.inputTokens),
              outputTokens: safeTokenNumber(completion.usage.outputTokens),
              priceId: completion.usage.priceId,
            },
          },
          taskId: payload.taskId,
          workspaceId: payload.workspaceId,
        });
        if (persisted?.status !== "completed") {
          throw new AiTaskExecutionError();
        }
        taskCompleted = true;
        try {
          await dependencies.onTaskCompleted?.({
            // The request's correlationId joins the ai.task_completed
            // delivery chain back to the submission that produced it.
            ...(payload.correlationId === undefined
              ? {}
              : { correlationId: payload.correlationId }),
            taskId: payload.taskId,
            workspaceId: payload.workspaceId,
          });
        } catch {
          // Webhook fan-out must not fail an already-persisted completion.
        }
        return await completeNotification(payload, dependencies);
      } catch {
        if (!taskCompleted) {
          const failedAt = dependencies.now();
          for (const reservationId of authorizedReservationIds) {
            // The winning attempt's usage row may already be persisted — keep
            // its settlement at real cost; every other hold releases at 0n.
            await releaseReservation(
              reservationId,
              reservationId === successfulReservationId && appendedUsageCostMicrounits !== null
                ? appendedUsageCostMicrounits
                : 0n,
              failedAt,
            );
          }
          try {
            await dependencies.repositories.markTaskRunFailed({
              completedAt: failedAt,
              errorCode: "ai_execution_failed",
              taskId: payload.taskId,
              workspaceId: payload.workspaceId,
            });
          } catch {
            // The Trigger boundary must never receive a raw persistence error.
          }
        }
        throw new AiTaskExecutionError();
      }
    },
  });
}

async function completeNotification(
  payload: ProductionAiTaskPayload,
  dependencies: ProductionAiTaskExecutorDependencies,
) {
  const deliveryId = `email_delivery_${payload.taskId}`;
  const recorded = await dependencies.repositories.listTransactionalEmailDeliveries({
    workspaceId: payload.workspaceId,
  });
  const alreadyAccepted = recorded.some(
    (delivery) =>
      delivery.id === deliveryId &&
      delivery.workspaceId === payload.workspaceId &&
      (delivery.status === "accepted" || delivery.status === "delivered"),
  );
  let completionEmail: Readonly<{ deliveryId: string; status: "accepted" }> | null = null;
  if (!alreadyAccepted) {
    const delivery = await dependencies.email.send({
      category: "transactional",
      subject: "Your AI task is complete",
      text: "Your AI task completed successfully. Open the app to view the result.",
      to: payload.completionEmailTo,
      workspaceId: payload.workspaceId,
    });
    await dependencies.repositories.recordTransactionalEmailDelivery({
      id: deliveryId,
      provider: dependencies.emailProvider,
      providerMessageId: delivery.id,
      recipient: payload.completionEmailTo,
      sentAt: dependencies.now(),
      status: "accepted",
      template: "ai-task-complete",
      workspaceId: payload.workspaceId,
    });
    completionEmail = { deliveryId: delivery.id, status: "accepted" };
  }
  return Object.freeze({
    completionEmail,
    status: "completed" as const,
    taskId: payload.taskId,
    workspaceId: payload.workspaceId,
  });
}

export function parseTriggeredAiTaskPayload(value: unknown): ProductionAiTaskPayload {
  if (!isRecord(value) || !isNonEmptyString(value.workspaceId) || !isRecord(value.input)) {
    throw new ProductionAiTaskPayloadError();
  }

  const payload = requirePayload(value.input);
  if (payload.workspaceId !== value.workspaceId) {
    throw new ProductionAiTaskPayloadError();
  }

  return payload;
}

function requirePayload(value: unknown): ProductionAiTaskPayload {
  if (!isRecord(value)) {
    throw new ProductionAiTaskPayloadError();
  }

  const requirements = requireRequirements(value.requirements);
  if (
    !isAlias(value.alias) ||
    !isNonEmptyString(value.prompt) ||
    value.prompt.length > 100_000 ||
    !isEmail(value.completionEmailTo) ||
    !isIdentifier(value.taskId) ||
    !isIdentifier(value.workspaceId)
  ) {
    throw new ProductionAiTaskPayloadError();
  }

  return Object.freeze({
    alias: value.alias,
    completionEmailTo: value.completionEmailTo,
    // Optional and opaque: a missing or malformed value is dropped rather
    // than failing the run — the executor mints a fresh id downstream.
    ...(isCorrelationId(value.correlationId) ? { correlationId: value.correlationId } : {}),
    prompt: value.prompt,
    requirements,
    taskId: value.taskId,
    workspaceId: value.workspaceId,
  });
}

function requireRequirements(value: unknown): ModelRequirements {
  if (!isRecord(value)) {
    throw new ProductionAiTaskPayloadError();
  }

  const allowedKeys = new Set(["minContext", "structuredOutput", "tools", "vision"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new ProductionAiTaskPayloadError();
  }
  for (const key of ["structuredOutput", "tools", "vision"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      throw new ProductionAiTaskPayloadError();
    }
  }
  if (
    value.minContext !== undefined &&
    (!Number.isSafeInteger(value.minContext) || (value.minContext as number) < 0)
  ) {
    throw new ProductionAiTaskPayloadError();
  }

  return Object.freeze({
    ...(value.minContext === undefined ? {} : { minContext: value.minContext as number }),
    ...(value.structuredOutput === undefined
      ? {}
      : { structuredOutput: value.structuredOutput as boolean }),
    ...(value.tools === undefined ? {} : { tools: value.tools as boolean }),
    ...(value.vision === undefined ? {} : { vision: value.vision as boolean }),
  });
}

export function safeTokenNumber(value: bigint): number {
  if (value < 0n || value > POSTGRES_INTEGER_MAX) {
    throw new Error("Provider token usage exceeded the database integer range.");
  }
  return Number(value);
}

export function estimateConservativeUsage(prompt: string) {
  return Object.freeze({
    cachedInputTokens: 0n,
    inputTokens: BigInt(Buffer.byteLength(prompt, "utf8")) + ESTIMATED_INPUT_OVERHEAD_TOKENS,
    outputTokens: ESTIMATED_OUTPUT_TOKENS,
  });
}

function isAlias(value: unknown): value is ModelAlias {
  return value === "fast" || value === "smart" || value === "cheap";
}

function isIdentifier(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= 255;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isEmail(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
