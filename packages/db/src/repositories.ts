import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { effectiveAiMonthlyBudget } from "./ai-budget-policy";
import { readAiSpendForPeriod } from "./ai-spend";

import {
  aiBudgetReservation,
  aiUsage,
  billingCustomer,
  billingSubscription,
  entitlement,
  taskRun,
  transactionalEmailDelivery,
  webhookEvent,
  workspace,
  workspaceAiPolicy,
} from "./schema";
import type * as schema from "./schema";

type JsonRecord = Record<string, unknown>;

export interface TaskResult {
  completedAt: Date | null;
  id: string;
  result: JsonRecord | null;
  status: string;
  workspaceId: string;
}

export interface PersistTaskResultInput {
  completedAt: Date;
  result: JsonRecord;
  taskId: string;
  workspaceId: string;
}

export interface SetTaskRunProviderRunIdInput {
  providerRunId: string;
  taskId: string;
  workspaceId: string;
}

export interface MarkTaskRunRunningInput {
  startedAt: Date;
  taskId: string;
  workspaceId: string;
}

export interface MarkTaskRunFailedInput {
  completedAt: Date;
  errorCode: string;
  taskId: string;
  workspaceId: string;
}

export interface RecordTaskRunInput {
  id: string;
  input: JsonRecord;
  providerRunId?: string;
  startedAt?: Date;
  status: string;
  taskName: string;
  workspaceId: string;
}

export interface ReadTaskResultInput {
  taskId: string;
  workspaceId: string;
}

export interface AiUsageRecord {
  cachedInputTokens: number;
  costMicrounits: bigint;
  createdAt: Date;
  id: string;
  inputTokens: number;
  latencyMs: number;
  model: string;
  outputTokens: number;
  priceId: string;
  provider: string;
  requestId: string;
  status: string;
  workspaceId: string;
}

export interface ListAiUsageInput {
  workspaceId: string;
}

export interface AuthorizeAiProviderAttemptInput {
  estimatedUsageMicrounits: bigint;
  reservationId: string;
  reservedAt: Date;
  taskId: string;
  workspaceId: string;
}

export type AiProviderAttemptAuthorization = Readonly<{
  reservationId: string | null;
  status: "authorized" | "budget_exceeded" | "entitlement_required";
}>;

export interface SettleAiBudgetReservationInput {
  actualCostMicrounits: bigint;
  reservationId: string;
  settledAt: Date;
  taskId: string;
  workspaceId: string;
}

export type BillingEntitlementStatus = "active" | "trialing" | "past_due" | "inactive";

export interface ApplyStripeBillingEventInput {
  customerId?: string;
  entitlement?: string;
  entitlementStatus: BillingEntitlementStatus;
  eventId: string;
  eventType: string;
  occurredAt: Date;
  payload: JsonRecord;
  priceId?: string;
  /** Billing provider namespace; defaults to "stripe". */
  provider?: string;
  subscriptionId?: string;
  verifiedAt: Date;
  workspaceId?: string;
}

export interface StripeBillingEventApplyResult {
  disposition: "duplicate" | "processed" | "stale";
  workspaceId: string;
}

export function shouldApplyStripeLifecycleEvent(
  input: Readonly<{
    incomingOccurredAt: Date;
    incomingStatus: BillingEntitlementStatus;
    storedOccurredAt: Date | null;
    storedStatus: string;
  }>,
): boolean {
  if (input.storedOccurredAt === null) {
    return true;
  }

  const timeDifference = input.incomingOccurredAt.getTime() - input.storedOccurredAt.getTime();
  if (timeDifference !== 0) {
    return timeDifference > 0;
  }

  return (
    lifecycleRevocationPriority(input.incomingStatus) >
    lifecycleRevocationPriority(input.storedStatus)
  );
}

function lifecycleRevocationPriority(status: string): number {
  if (status === "inactive") {
    return 2;
  }
  if (status === "past_due") {
    return 1;
  }
  return 0;
}

export interface BillingCustomerRecord {
  provider: string;
  providerCustomerId: string;
  workspaceId: string;
}

export interface ReadBillingCustomerInput {
  provider: string;
  workspaceId: string;
}

export interface WebhookEventRecord {
  id: string;
  payload: JsonRecord;
  processedAt: Date | null;
  provider: string;
  providerEventId: string;
  status: string;
  verifiedAt: Date;
  workspaceId: string;
}

export interface RecordWebhookInput {
  id: string;
  payload: JsonRecord;
  provider: string;
  providerEventId: string;
  verifiedAt: Date;
  workspaceId: string;
}

export interface ReadWebhookInput {
  provider: string;
  providerEventId: string;
  workspaceId: string;
}

export interface MarkWebhookProcessedInput extends ReadWebhookInput {
  processedAt: Date;
  status: string;
}

export interface WebhookRecordResult {
  event: WebhookEventRecord;
  isDuplicate: boolean;
}

export interface TransactionalEmailDeliveryRecord {
  errorCode?: string | null;
  id: string;
  provider: string;
  providerMessageId?: string | null;
  recipient: string;
  sentAt?: Date | null;
  status: string;
  template: string;
  workspaceId: string;
}

export interface ListTransactionalEmailDeliveriesInput {
  workspaceId: string;
}

export type RepositoryCommand =
  | { input: ApplyStripeBillingEventInput; kind: "applyStripeBillingEvent" }
  | { input: ReadBillingCustomerInput; kind: "readBillingCustomer" }
  | { input: RecordTaskRunInput; kind: "recordTaskRun" }
  | { input: SetTaskRunProviderRunIdInput; kind: "setTaskRunProviderRunId" }
  | { input: MarkTaskRunRunningInput; kind: "markTaskRunRunning" }
  | { input: MarkTaskRunFailedInput; kind: "markTaskRunFailed" }
  | { input: PersistTaskResultInput; kind: "persistTaskResult" }
  | { input: ReadTaskResultInput; kind: "readTaskResult" }
  | { input: AiUsageRecord; kind: "appendAiUsage" }
  | { input: ListAiUsageInput; kind: "listAiUsage" }
  | { input: AuthorizeAiProviderAttemptInput; kind: "authorizeAiProviderAttempt" }
  | { input: SettleAiBudgetReservationInput; kind: "settleAiBudgetReservation" }
  | { input: RecordWebhookInput; kind: "recordWebhook" }
  | { input: ReadWebhookInput; kind: "readWebhook" }
  | { input: MarkWebhookProcessedInput; kind: "markWebhookProcessed" }
  | { input: TransactionalEmailDeliveryRecord; kind: "recordTransactionalEmailDelivery" }
  | { input: ListTransactionalEmailDeliveriesInput; kind: "listTransactionalEmailDeliveries" };

export interface RepositoryExecutor {
  execute: (command: RepositoryCommand) => Promise<unknown>;
}

export function createWorkspaceRepositories(executor: RepositoryExecutor) {
  return {
    applyStripeBillingEvent: async (input: ApplyStripeBillingEventInput) =>
      (await executor.execute({
        input,
        kind: "applyStripeBillingEvent",
      })) as StripeBillingEventApplyResult,
    appendAiUsage: async (input: AiUsageRecord) =>
      (await executor.execute({ input, kind: "appendAiUsage" })) as AiUsageRecord,
    authorizeAiProviderAttempt: async (input: AuthorizeAiProviderAttemptInput) =>
      (await executor.execute({
        input,
        kind: "authorizeAiProviderAttempt",
      })) as AiProviderAttemptAuthorization,
    listAiUsage: async (input: ListAiUsageInput) =>
      (await executor.execute({ input, kind: "listAiUsage" })) as AiUsageRecord[],
    listTransactionalEmailDeliveries: async (input: ListTransactionalEmailDeliveriesInput) =>
      (await executor.execute({
        input,
        kind: "listTransactionalEmailDeliveries",
      })) as TransactionalEmailDeliveryRecord[],
    markWebhookProcessed: async (input: MarkWebhookProcessedInput) =>
      (await executor.execute({
        input,
        kind: "markWebhookProcessed",
      })) as WebhookEventRecord | null,
    markTaskRunFailed: async (input: MarkTaskRunFailedInput) =>
      (await executor.execute({ input, kind: "markTaskRunFailed" })) as TaskResult | null,
    markTaskRunRunning: async (input: MarkTaskRunRunningInput) =>
      (await executor.execute({ input, kind: "markTaskRunRunning" })) as TaskResult | null,
    recordTaskRun: async (input: RecordTaskRunInput) =>
      (await executor.execute({ input, kind: "recordTaskRun" })) as TaskResult,
    persistTaskResult: async (input: PersistTaskResultInput) =>
      (await executor.execute({ input, kind: "persistTaskResult" })) as TaskResult | null,
    readTaskResult: async (input: ReadTaskResultInput) =>
      (await executor.execute({ input, kind: "readTaskResult" })) as TaskResult | null,
    readBillingCustomer: async (input: ReadBillingCustomerInput) =>
      (await executor.execute({
        input,
        kind: "readBillingCustomer",
      })) as BillingCustomerRecord | null,
    setTaskRunProviderRunId: async (input: SetTaskRunProviderRunIdInput) =>
      (await executor.execute({ input, kind: "setTaskRunProviderRunId" })) as TaskResult | null,
    settleAiBudgetReservation: async (input: SettleAiBudgetReservationInput) =>
      (await executor.execute({ input, kind: "settleAiBudgetReservation" })) as null,
    readWebhook: async (input: ReadWebhookInput) =>
      (await executor.execute({ input, kind: "readWebhook" })) as WebhookEventRecord | null,
    recordTransactionalEmailDelivery: async (input: TransactionalEmailDeliveryRecord) =>
      (await executor.execute({
        input,
        kind: "recordTransactionalEmailDelivery",
      })) as TransactionalEmailDeliveryRecord,
    recordWebhook: async (input: RecordWebhookInput) =>
      (await executor.execute({ input, kind: "recordWebhook" })) as WebhookRecordResult,
  };
}

export function createDrizzleRepositoryExecutor(
  database: PostgresJsDatabase<typeof schema>,
): RepositoryExecutor {
  return {
    execute: async (command) => {
      switch (command.kind) {
        case "applyStripeBillingEvent":
          return database.transaction(async (transaction) => {
            const input = command.input;
            const provider = input.provider ?? "stripe";
            let storedSubscription: typeof billingSubscription.$inferSelect | undefined;

            if (input.subscriptionId !== undefined) {
              await transaction.execute(
                sql`select pg_advisory_xact_lock(hashtextextended(${`${provider}:${input.subscriptionId}`}, 0))`,
              );
              [storedSubscription] = await transaction
                .select()
                .from(billingSubscription)
                .where(
                  and(
                    eq(billingSubscription.provider, provider),
                    eq(billingSubscription.providerSubscriptionId, input.subscriptionId),
                  ),
                )
                .for("update")
                .limit(1);
            }

            const workspaceId = input.workspaceId ?? storedSubscription?.workspaceId;
            const entitlementKey = input.entitlement ?? storedSubscription?.entitlementKey;
            const providerCustomerId = input.customerId ?? storedSubscription?.providerCustomerId;
            const providerSubscriptionId =
              input.subscriptionId ?? storedSubscription?.providerSubscriptionId;
            const priceReference = input.priceId ?? storedSubscription?.priceReference;

            if (
              workspaceId === undefined ||
              entitlementKey === undefined ||
              providerCustomerId === undefined ||
              providerSubscriptionId === undefined ||
              priceReference === undefined
            ) {
              throw new Error(
                "verified billing event cannot be routed to a complete workspace subscription",
              );
            }

            if (
              storedSubscription !== undefined &&
              storedSubscription.workspaceId !== workspaceId
            ) {
              throw new Error("billing subscription is already owned by another workspace");
            }

            const [insertedWebhook] = await transaction
              .insert(webhookEvent)
              .values({
                id: `${provider}_webhook:${input.eventId}`,
                payload: input.payload,
                provider,
                providerEventId: input.eventId,
                status: "received",
                verifiedAt: input.verifiedAt,
                workspaceId,
              })
              .onConflictDoNothing({
                target: [webhookEvent.provider, webhookEvent.providerEventId],
              })
              .returning();

            if (insertedWebhook === undefined) {
              const [existingWebhook] = await transaction
                .select()
                .from(webhookEvent)
                .where(
                  and(
                    eq(webhookEvent.provider, provider),
                    eq(webhookEvent.providerEventId, input.eventId),
                  ),
                )
                .limit(1);

              if (existingWebhook === undefined || existingWebhook.workspaceId !== workspaceId) {
                throw new Error("billing webhook event is already owned by another workspace");
              }

              if (existingWebhook.status === "processed") {
                return { disposition: "duplicate" as const, workspaceId };
              }
            }

            if (
              storedSubscription !== undefined &&
              !shouldApplyStripeLifecycleEvent({
                incomingOccurredAt: input.occurredAt,
                incomingStatus: input.entitlementStatus,
                storedOccurredAt: storedSubscription.latestEventOccurredAt,
                storedStatus: storedSubscription.status,
              })
            ) {
              await transaction
                .update(webhookEvent)
                .set({ processedAt: new Date(), status: "processed", updatedAt: new Date() })
                .where(
                  and(
                    eq(webhookEvent.provider, provider),
                    eq(webhookEvent.providerEventId, input.eventId),
                    eq(webhookEvent.workspaceId, workspaceId),
                  ),
                );
              return { disposition: "stale" as const, workspaceId };
            }

            await transaction
              .insert(billingCustomer)
              .values({
                id: `${provider}_customer:${providerCustomerId}`,
                provider,
                providerCustomerId,
                workspaceId,
              })
              .onConflictDoNothing();

            const [storedCustomer] = await transaction
              .select({
                provider: billingCustomer.provider,
                providerCustomerId: billingCustomer.providerCustomerId,
                workspaceId: billingCustomer.workspaceId,
              })
              .from(billingCustomer)
              .where(
                and(
                  eq(billingCustomer.provider, provider),
                  eq(billingCustomer.providerCustomerId, providerCustomerId),
                ),
              )
              .limit(1);

            if (storedCustomer === undefined || storedCustomer.workspaceId !== workspaceId) {
              throw new Error("billing customer is already owned by another workspace");
            }

            await transaction
              .insert(billingSubscription)
              .values({
                entitlementKey,
                id: `${provider}_subscription:${providerSubscriptionId}`,
                priceReference,
                provider,
                providerCustomerId,
                providerSubscriptionId,
                status: input.entitlementStatus,
                latestEventOccurredAt: input.occurredAt,
                workspaceId,
              })
              .onConflictDoUpdate({
                target: [billingSubscription.provider, billingSubscription.providerSubscriptionId],
                set: {
                  entitlementKey,
                  priceReference,
                  providerCustomerId,
                  status: input.entitlementStatus,
                  latestEventOccurredAt: input.occurredAt,
                  updatedAt: new Date(),
                },
              });

            await transaction
              .insert(entitlement)
              .values({
                id: `${provider}_entitlement:${workspaceId}:${entitlementKey}`,
                key: entitlementKey,
                source: provider,
                sourceReference: providerSubscriptionId,
                status: input.entitlementStatus,
                workspaceId,
              })
              .onConflictDoUpdate({
                target: [entitlement.workspaceId, entitlement.key, entitlement.source],
                set: {
                  sourceReference: providerSubscriptionId,
                  status: input.entitlementStatus,
                  updatedAt: new Date(),
                },
              });

            await transaction
              .update(webhookEvent)
              .set({ processedAt: new Date(), status: "processed", updatedAt: new Date() })
              .where(
                and(
                  eq(webhookEvent.provider, provider),
                  eq(webhookEvent.providerEventId, input.eventId),
                  eq(webhookEvent.workspaceId, workspaceId),
                ),
              );

            return { disposition: "processed" as const, workspaceId };
          });
        case "readBillingCustomer": {
          const [record] = await database
            .select({
              provider: billingCustomer.provider,
              providerCustomerId: billingCustomer.providerCustomerId,
              workspaceId: billingCustomer.workspaceId,
            })
            .from(billingCustomer)
            .where(
              and(
                eq(billingCustomer.provider, command.input.provider),
                eq(billingCustomer.workspaceId, command.input.workspaceId),
              ),
            )
            .limit(1);

          return record ?? null;
        }
        case "recordTaskRun": {
          const [record] = await database.insert(taskRun).values(command.input).returning({
            completedAt: taskRun.completedAt,
            id: taskRun.id,
            result: taskRun.result,
            status: taskRun.status,
            workspaceId: taskRun.workspaceId,
          });

          if (!record) {
            throw new Error("task run was not created");
          }

          return record;
        }
        case "setTaskRunProviderRunId": {
          const [record] = await database
            .update(taskRun)
            .set({ providerRunId: command.input.providerRunId, updatedAt: new Date() })
            .where(
              and(
                eq(taskRun.id, command.input.taskId),
                eq(taskRun.workspaceId, command.input.workspaceId),
              ),
            )
            .returning({
              completedAt: taskRun.completedAt,
              id: taskRun.id,
              result: taskRun.result,
              status: taskRun.status,
              workspaceId: taskRun.workspaceId,
            });

          return record ?? null;
        }
        case "markTaskRunRunning": {
          const [record] = await database
            .update(taskRun)
            .set({ startedAt: command.input.startedAt, status: "running", updatedAt: new Date() })
            .where(
              and(
                eq(taskRun.id, command.input.taskId),
                eq(taskRun.status, "queued"),
                eq(taskRun.workspaceId, command.input.workspaceId),
              ),
            )
            .returning({
              completedAt: taskRun.completedAt,
              id: taskRun.id,
              result: taskRun.result,
              status: taskRun.status,
              workspaceId: taskRun.workspaceId,
            });

          return record ?? null;
        }
        case "markTaskRunFailed": {
          const [record] = await database
            .update(taskRun)
            .set({
              completedAt: command.input.completedAt,
              errorCode: command.input.errorCode,
              status: "failed",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(taskRun.id, command.input.taskId),
                inArray(taskRun.status, ["queued", "running"]),
                eq(taskRun.workspaceId, command.input.workspaceId),
              ),
            )
            .returning({
              completedAt: taskRun.completedAt,
              id: taskRun.id,
              result: taskRun.result,
              status: taskRun.status,
              workspaceId: taskRun.workspaceId,
            });

          return record ?? null;
        }
        case "persistTaskResult": {
          const [record] = await database
            .update(taskRun)
            .set({
              completedAt: command.input.completedAt,
              result: command.input.result,
              status: "completed",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(taskRun.id, command.input.taskId),
                eq(taskRun.status, "running"),
                eq(taskRun.workspaceId, command.input.workspaceId),
              ),
            )
            .returning({
              completedAt: taskRun.completedAt,
              id: taskRun.id,
              result: taskRun.result,
              status: taskRun.status,
              workspaceId: taskRun.workspaceId,
            });

          return record ?? null;
        }
        case "readTaskResult": {
          const [record] = await database
            .select({
              completedAt: taskRun.completedAt,
              id: taskRun.id,
              result: taskRun.result,
              status: taskRun.status,
              workspaceId: taskRun.workspaceId,
            })
            .from(taskRun)
            .where(
              and(
                eq(taskRun.id, command.input.taskId),
                eq(taskRun.workspaceId, command.input.workspaceId),
              ),
            )
            .limit(1);

          return record ?? null;
        }
        case "appendAiUsage": {
          const [record] = await database
            .insert(aiUsage)
            .values(command.input)
            .onConflictDoNothing({ target: aiUsage.requestId })
            .returning();

          if (record) {
            return record;
          }

          const [existing] = await database
            .select()
            .from(aiUsage)
            .where(eq(aiUsage.requestId, command.input.requestId))
            .limit(1);
          if (existing?.workspaceId !== command.input.workspaceId) {
            throw new Error("AI usage request is already owned by another workspace");
          }

          return existing;
        }
        case "authorizeAiProviderAttempt": {
          const input = command.input;
          if (input.estimatedUsageMicrounits < 0n) {
            throw new Error("AI budget reservation must be non-negative");
          }

          return database.transaction(async (transaction) => {
            const [ownedTask] = await transaction
              .select({ id: taskRun.id })
              .from(taskRun)
              .where(and(eq(taskRun.id, input.taskId), eq(taskRun.workspaceId, input.workspaceId)))
              .limit(1);
            if (ownedTask === undefined) {
              throw new Error("AI budget reservation task is not owned by this workspace");
            }

            const [activeEntitlement] = await transaction
              .select({ id: entitlement.id })
              .from(entitlement)
              .where(
                and(
                  eq(entitlement.workspaceId, input.workspaceId),
                  eq(entitlement.key, "ai.reference-task"),
                  or(eq(entitlement.status, "active"), eq(entitlement.status, "trialing")),
                  or(isNull(entitlement.expiresAt), gt(entitlement.expiresAt, input.reservedAt)),
                ),
              )
              .limit(1);
            if (activeEntitlement === undefined) {
              return { reservationId: null, status: "entitlement_required" as const };
            }

            // A policy row is optional. Lock the workspace row so concurrent
            // reservations still serialize when the default budget applies.
            const [budgetOwner] = await transaction
              .select({ id: workspace.id })
              .from(workspace)
              .where(eq(workspace.id, input.workspaceId))
              .for("update")
              .limit(1);
            if (budgetOwner === undefined) {
              throw new Error("AI budget workspace is unavailable");
            }

            const [policy] = await transaction
              .select({
                keyMode: workspaceAiPolicy.keyMode,
                monthlyBudgetMicrounits: workspaceAiPolicy.monthlyBudgetMicrounits,
              })
              .from(workspaceAiPolicy)
              .where(eq(workspaceAiPolicy.workspaceId, input.workspaceId))
              .for("update")
              .limit(1);
            const monthlyBudgetMicrounits = effectiveAiMonthlyBudget(policy);
            if (monthlyBudgetMicrounits === null) {
              return { reservationId: null, status: "authorized" as const };
            }

            const [existing] = await transaction
              .select({
                reservedMicrounits: aiBudgetReservation.reservedMicrounits,
                status: aiBudgetReservation.status,
                taskId: aiBudgetReservation.taskId,
                workspaceId: aiBudgetReservation.workspaceId,
              })
              .from(aiBudgetReservation)
              .where(eq(aiBudgetReservation.id, input.reservationId))
              .limit(1);
            if (existing !== undefined) {
              if (
                existing.workspaceId !== input.workspaceId ||
                existing.taskId !== input.taskId ||
                existing.status !== "reserved" ||
                existing.reservedMicrounits < input.estimatedUsageMicrounits
              ) {
                throw new Error("AI budget reservation cannot be reused for this provider attempt");
              }
              return { reservationId: input.reservationId, status: "authorized" as const };
            }

            const periodStart = monthStart(input.reservedAt);
            const { committedMicrounits, heldMicrounits } = await readAiSpendForPeriod(
              transaction,
              input.workspaceId,
              periodStart,
            );
            if (
              committedMicrounits + heldMicrounits + input.estimatedUsageMicrounits >
              monthlyBudgetMicrounits
            ) {
              return { reservationId: null, status: "budget_exceeded" as const };
            }

            await transaction.insert(aiBudgetReservation).values({
              id: input.reservationId,
              periodStart,
              reservedMicrounits: input.estimatedUsageMicrounits,
              status: "reserved",
              taskId: input.taskId,
              workspaceId: input.workspaceId,
            });
            return { reservationId: input.reservationId, status: "authorized" as const };
          });
        }
        case "settleAiBudgetReservation": {
          const input = command.input;
          if (input.actualCostMicrounits < 0n) {
            throw new Error("AI budget settlement must be non-negative");
          }

          const [record] = await database
            .update(aiBudgetReservation)
            .set({
              settledMicrounits: input.actualCostMicrounits,
              status: "settled",
              updatedAt: input.settledAt,
            })
            .where(
              and(
                eq(aiBudgetReservation.id, input.reservationId),
                eq(aiBudgetReservation.taskId, input.taskId),
                eq(aiBudgetReservation.workspaceId, input.workspaceId),
                eq(aiBudgetReservation.status, "reserved"),
              ),
            )
            .returning({ id: aiBudgetReservation.id });
          if (record === undefined) {
            throw new Error("AI budget reservation was not available to settle");
          }
          return null;
        }
        case "listAiUsage":
          return database
            .select()
            .from(aiUsage)
            .where(eq(aiUsage.workspaceId, command.input.workspaceId))
            .orderBy(desc(aiUsage.createdAt));
        case "recordWebhook": {
          const [record] = await database
            .insert(webhookEvent)
            .values({ ...command.input, status: "received" })
            .onConflictDoNothing({ target: [webhookEvent.provider, webhookEvent.providerEventId] })
            .returning();

          if (record) {
            return { event: record, isDuplicate: false };
          }

          const [existing] = await database
            .select()
            .from(webhookEvent)
            .where(
              and(
                eq(webhookEvent.workspaceId, command.input.workspaceId),
                eq(webhookEvent.provider, command.input.provider),
                eq(webhookEvent.providerEventId, command.input.providerEventId),
              ),
            )
            .limit(1);

          if (!existing) {
            throw new Error("webhook event is already owned by another workspace");
          }

          return { event: existing, isDuplicate: true };
        }
        case "readWebhook": {
          const [record] = await database
            .select()
            .from(webhookEvent)
            .where(
              and(
                eq(webhookEvent.workspaceId, command.input.workspaceId),
                eq(webhookEvent.provider, command.input.provider),
                eq(webhookEvent.providerEventId, command.input.providerEventId),
              ),
            )
            .limit(1);

          return record ?? null;
        }
        case "markWebhookProcessed": {
          const [record] = await database
            .update(webhookEvent)
            .set({
              processedAt: command.input.processedAt,
              status: command.input.status,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(webhookEvent.workspaceId, command.input.workspaceId),
                eq(webhookEvent.provider, command.input.provider),
                eq(webhookEvent.providerEventId, command.input.providerEventId),
              ),
            )
            .returning();

          return record ?? null;
        }
        case "recordTransactionalEmailDelivery": {
          const [record] = await database
            .insert(transactionalEmailDelivery)
            .values(command.input)
            .onConflictDoNothing({ target: transactionalEmailDelivery.id })
            .returning();

          if (record) {
            return record;
          }

          const [existing] = await database
            .select()
            .from(transactionalEmailDelivery)
            .where(eq(transactionalEmailDelivery.id, command.input.id))
            .limit(1);
          if (existing?.workspaceId !== command.input.workspaceId) {
            throw new Error("Email delivery is already owned by another workspace");
          }

          return existing;
        }
        case "listTransactionalEmailDeliveries":
          return database
            .select()
            .from(transactionalEmailDelivery)
            .where(eq(transactionalEmailDelivery.workspaceId, command.input.workspaceId))
            .orderBy(desc(transactionalEmailDelivery.createdAt));
      }
    },
  };
}

function monthStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}
