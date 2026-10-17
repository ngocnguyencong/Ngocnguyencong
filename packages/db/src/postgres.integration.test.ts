import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { beforeAll, describe, expect, it } from "vitest";

import {
  aiBudgetReservation,
  aiModel,
  aiModelPrice,
  entitlement,
  workspace,
  workspaceAiPolicy,
} from "./schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

integrationDescribe("PostgreSQL migration smoke", () => {
  beforeAll(async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });

    try {
      await migrate(lifecycle.database, { migrationsFolder });
    } finally {
      await lifecycle.close();
    }
  });

  it("applies committed migrations and persists the minimum workspace-scoped repository path", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleRepositoryExecutor, createWorkspaceRepositories } = await import(
      "./" + "repositories.js"
    );
    const { createDrizzleProviderCredentialRepository } = await import(
      "./" + "provider-credentials.js"
    );
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    const workspaceId = `test_workspace_${suffix}`;
    const modelId = `test_model_${suffix}`;
    const priceId = `test_price_${suffix}`;
    const taskId = `test_task_${suffix}`;
    const now = new Date("2026-09-03T12:00:00.000Z");

    try {
      await lifecycle.database.insert(workspace).values({
        id: workspaceId,
        name: "Migration smoke workspace",
        slug: `migration-smoke-${suffix}`,
        type: "personal",
      });
      await lifecycle.database.insert(workspaceAiPolicy).values({
        keyMode: "byok",
        monthlyBudgetMicrounits: 5_000_000n,
        workspaceId,
      });
      await lifecycle.database.insert(aiModel).values({
        contextWindow: 16_000,
        id: modelId,
        model: "smoke-model",
        modelVersion: "2026-09-03",
        provider: "fake",
      });
      await lifecycle.database.insert(aiModelPrice).values({
        cachedInputMicrounitsPerMillion: 0n,
        effectiveFrom: now,
        id: priceId,
        inputMicrounitsPerMillion: 10n,
        model: "smoke-model",
        modelId,
        modelVersion: "2026-09-03",
        outputMicrounitsPerMillion: 20n,
        provider: "fake",
      });
      const repositories = createWorkspaceRepositories(
        createDrizzleRepositoryExecutor(lifecycle.database),
      );
      const credentials = createDrizzleProviderCredentialRepository(lifecycle.database);
      await credentials.put({
        algorithm: "aes-256-gcm",
        authTag: "c3ludGhldGljLXRhZw==",
        ciphertext: "c3ludGhldGljLWNpcGhlcnRleHQ=",
        iv: "c3ludGhldGljLWl2",
        provider: "openai",
        version: 1,
        workspaceId,
      });
      await expect(credentials.get({ provider: "openai", workspaceId })).resolves.toMatchObject({
        ciphertext: "c3ludGhldGljLWNpcGhlcnRleHQ=",
        provider: "openai",
        workspaceId,
      });
      await repositories.recordTaskRun({
        id: taskId,
        input: { prompt: "hello" },
        status: "queued",
        taskName: "smoke",
        workspaceId,
      });
      await expect(
        repositories.setTaskRunProviderRunId({
          providerRunId: `run_${suffix}`,
          taskId,
          workspaceId,
        }),
      ).resolves.toMatchObject({ id: taskId, status: "queued", workspaceId });
      await expect(
        repositories.markTaskRunRunning({ startedAt: now, taskId, workspaceId }),
      ).resolves.toMatchObject({ id: taskId, status: "running", workspaceId });
      await expect(
        repositories.markTaskRunRunning({ startedAt: now, taskId, workspaceId }),
      ).resolves.toBeNull();
      const result = { answer: "persisted" };

      await expect(
        repositories.persistTaskResult({ completedAt: now, result, taskId, workspaceId }),
      ).resolves.toMatchObject({
        id: taskId,
        result,
        workspaceId,
      });
      await expect(repositories.readTaskResult({ taskId, workspaceId })).resolves.toMatchObject({
        result,
        status: "completed",
        workspaceId,
      });
      await expect(
        repositories.markTaskRunFailed({
          completedAt: now,
          errorCode: "late_worker_failure",
          taskId,
          workspaceId,
        }),
      ).resolves.toBeNull();
      await expect(repositories.readTaskResult({ taskId, workspaceId })).resolves.toMatchObject({
        result,
        status: "completed",
        workspaceId,
      });

      const failedTaskId = `test_failed_task_${suffix}`;
      await repositories.recordTaskRun({
        id: failedTaskId,
        input: { prompt: "failed" },
        status: "queued",
        taskName: "smoke",
        workspaceId,
      });
      await repositories.markTaskRunFailed({
        completedAt: now,
        errorCode: "worker_failed",
        taskId: failedTaskId,
        workspaceId,
      });
      await expect(
        repositories.persistTaskResult({
          completedAt: now,
          result: { answer: "must-not-revive" },
          taskId: failedTaskId,
          workspaceId,
        }),
      ).resolves.toBeNull();
      await expect(
        repositories.appendAiUsage({
          cachedInputTokens: 0,
          costMicrounits: 1n,
          createdAt: now,
          id: `test_usage_${suffix}`,
          inputTokens: 10,
          latencyMs: 25,
          model: "smoke-model",
          outputTokens: 2,
          priceId,
          provider: "fake",
          requestId: `test_request_${suffix}`,
          status: "completed",
          workspaceId,
        }),
      ).resolves.toMatchObject({ costMicrounits: 1n, priceId, workspaceId });
      await expect(
        repositories.recordWebhook({
          id: `test_webhook_${suffix}`,
          payload: { type: "invoice.paid" },
          provider: "stripe",
          providerEventId: `test_event_${suffix}`,
          verifiedAt: now,
          workspaceId,
        }),
      ).resolves.toMatchObject({ isDuplicate: false });
      await expect(
        repositories.recordWebhook({
          id: `test_webhook_duplicate_${suffix}`,
          payload: { type: "invoice.paid" },
          provider: "stripe",
          providerEventId: `test_event_${suffix}`,
          verifiedAt: now,
          workspaceId,
        }),
      ).resolves.toMatchObject({ isDuplicate: true });
      await expect(
        repositories.recordTransactionalEmailDelivery({
          id: `test_delivery_${suffix}`,
          provider: "resend",
          recipient: "recipient@example.com",
          sentAt: now,
          status: "sent",
          template: "task-complete",
          workspaceId,
        }),
      ).resolves.toMatchObject({ recipient: "recipient@example.com", workspaceId });
      await expect(repositories.listTransactionalEmailDeliveries({ workspaceId })).resolves.toEqual(
        [expect.objectContaining({ workspaceId })],
      );

      const subscriptionId = `sub_${suffix}`;
      const customerId = `cus_${suffix}`;
      const billingEvent = {
        customerId,
        entitlement: "ai.reference-task",
        entitlementStatus: "active" as const,
        eventId: `evt_subscription_${suffix}`,
        eventType: "customer.subscription.created",
        occurredAt: now,
        payload: { id: `evt_subscription_${suffix}`, type: "customer.subscription.created" },
        priceId: "price_monthly",
        subscriptionId,
        verifiedAt: now,
        workspaceId,
      };

      await expect(repositories.applyStripeBillingEvent(billingEvent)).resolves.toEqual({
        disposition: "processed",
        workspaceId,
      });
      await expect(repositories.applyStripeBillingEvent(billingEvent)).resolves.toEqual({
        disposition: "duplicate",
        workspaceId,
      });
      await expect(
        repositories.readBillingCustomer({ provider: "stripe", workspaceId }),
      ).resolves.toEqual({ provider: "stripe", providerCustomerId: customerId, workspaceId });
      await expect(
        repositories.applyStripeBillingEvent({
          entitlementStatus: "past_due",
          eventId: `evt_invoice_failed_${suffix}`,
          eventType: "invoice.payment_failed",
          occurredAt: new Date(now.getTime() + 60_000),
          payload: { id: `evt_invoice_failed_${suffix}`, type: "invoice.payment_failed" },
          subscriptionId,
          verifiedAt: now,
        }),
      ).resolves.toEqual({ disposition: "processed", workspaceId });
      await expect(
        repositories.applyStripeBillingEvent({
          entitlementStatus: "active",
          eventId: `evt_stale_paid_${suffix}`,
          eventType: "invoice.paid",
          occurredAt: now,
          payload: { id: `evt_stale_paid_${suffix}`, type: "invoice.paid" },
          subscriptionId,
          verifiedAt: new Date(now.getTime() + 120_000),
        }),
      ).resolves.toEqual({ disposition: "stale", workspaceId });

      const [storedEntitlement] = await lifecycle.database
        .select({ status: entitlement.status, workspaceId: entitlement.workspaceId })
        .from(entitlement)
        .where(eq(entitlement.workspaceId, workspaceId));
      expect(storedEntitlement).toEqual({ status: "past_due", workspaceId });
    } finally {
      await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      await lifecycle.database.delete(aiModelPrice).where(eq(aiModelPrice.id, priceId));
      await lifecycle.database.delete(aiModel).where(eq(aiModel.id, modelId));
      await lifecycle.close();
    }
  });

  it("serializes default platform budget holds without a policy row and counts settled spend", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleRepositoryExecutor, createWorkspaceRepositories } = await import(
      "./" + "repositories.js"
    );
    const primaryLifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const competingLifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const repositories = createWorkspaceRepositories(
      createDrizzleRepositoryExecutor(primaryLifecycle.database),
    );
    const competingRepositories = createWorkspaceRepositories(
      createDrizzleRepositoryExecutor(competingLifecycle.database),
    );
    const suffix = randomUUID().replaceAll("-", "");
    const workspaceId = `test_budget_workspace_${suffix}`;
    const modelId = `test_budget_model_${suffix}`;
    const priceId = `test_budget_price_${suffix}`;
    const firstTaskId = `test_budget_first_task_${suffix}`;
    const secondTaskId = `test_budget_second_task_${suffix}`;
    const settlementTaskId = `test_budget_settlement_task_${suffix}`;
    const now = new Date("2026-09-04T12:00:00.000Z");
    const reservationMicrounits = 3_000_000n;

    try {
      await primaryLifecycle.database.insert(workspace).values({
        id: workspaceId,
        name: "Budget smoke workspace",
        slug: `budget-smoke-${suffix}`,
        type: "personal",
      });
      await primaryLifecycle.database.insert(entitlement).values({
        id: `test_budget_entitlement_${suffix}`,
        key: "ai.reference-task",
        source: "integration-test",
        status: "active",
        workspaceId,
      });
      await primaryLifecycle.database.insert(aiModel).values({
        contextWindow: 16_000,
        id: modelId,
        model: "budget-smoke-model",
        modelVersion: "2026-09-04",
        provider: "fake",
      });
      await primaryLifecycle.database.insert(aiModelPrice).values({
        cachedInputMicrounitsPerMillion: 0n,
        effectiveFrom: now,
        id: priceId,
        inputMicrounitsPerMillion: 10n,
        model: "budget-smoke-model",
        modelId,
        modelVersion: "2026-09-04",
        outputMicrounitsPerMillion: 20n,
        provider: "fake",
      });
      for (const taskId of [firstTaskId, secondTaskId, settlementTaskId]) {
        await repositories.recordTaskRun({
          id: taskId,
          input: { prompt: "budget" },
          status: "queued",
          taskName: "budget-smoke",
          workspaceId,
        });
      }

      const firstAuthorizationInput = {
        estimatedUsageMicrounits: reservationMicrounits,
        reservationId: `test_budget_reservation_first_${suffix}`,
        reservedAt: now,
        taskId: firstTaskId,
        workspaceId,
      };
      const secondAuthorizationInput = {
        estimatedUsageMicrounits: reservationMicrounits,
        reservationId: `test_budget_reservation_second_${suffix}`,
        reservedAt: now,
        taskId: secondTaskId,
        workspaceId,
      };
      const [firstAuthorization, secondAuthorization] = await Promise.all([
        repositories.authorizeAiProviderAttempt(firstAuthorizationInput),
        competingRepositories.authorizeAiProviderAttempt(secondAuthorizationInput),
      ]);

      expect([firstAuthorization.status, secondAuthorization.status].sort()).toEqual([
        "authorized",
        "budget_exceeded",
      ]);
      const authorizedAttempt =
        firstAuthorization.status === "authorized"
          ? { input: firstAuthorizationInput, repository: repositories }
          : { input: secondAuthorizationInput, repository: competingRepositories };

      await expect(
        authorizedAttempt.repository.authorizeAiProviderAttempt(authorizedAttempt.input),
      ).resolves.toEqual({
        reservationId: authorizedAttempt.input.reservationId,
        status: "authorized",
      });
      const heldReservations = await primaryLifecycle.database
        .select({
          id: aiBudgetReservation.id,
          reservedMicrounits: aiBudgetReservation.reservedMicrounits,
          status: aiBudgetReservation.status,
          taskId: aiBudgetReservation.taskId,
        })
        .from(aiBudgetReservation)
        .where(eq(aiBudgetReservation.workspaceId, workspaceId));
      expect(heldReservations).toEqual([
        {
          id: authorizedAttempt.input.reservationId,
          reservedMicrounits: reservationMicrounits,
          status: "reserved",
          taskId: authorizedAttempt.input.taskId,
        },
      ]);

      await authorizedAttempt.repository.appendAiUsage({
        cachedInputTokens: 0,
        costMicrounits: 2_000_000n,
        createdAt: now,
        id: `test_budget_usage_${suffix}`,
        inputTokens: 10,
        latencyMs: 25,
        model: "budget-smoke-model",
        outputTokens: 2,
        priceId,
        provider: "fake",
        requestId: `test_budget_request_${suffix}`,
        status: "completed",
        workspaceId,
      });
      await authorizedAttempt.repository.settleAiBudgetReservation({
        actualCostMicrounits: 2_000_000n,
        reservationId: authorizedAttempt.input.reservationId,
        settledAt: new Date(now.getTime() + 1_000),
        taskId: authorizedAttempt.input.taskId,
        workspaceId,
      });

      await expect(
        repositories.authorizeAiProviderAttempt({
          estimatedUsageMicrounits: reservationMicrounits,
          reservationId: `test_budget_reservation_settled_${suffix}`,
          reservedAt: now,
          taskId: settlementTaskId,
          workspaceId,
        }),
      ).resolves.toEqual({
        reservationId: `test_budget_reservation_settled_${suffix}`,
        status: "authorized",
      });
    } finally {
      await primaryLifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      await primaryLifecycle.database.delete(aiModelPrice).where(eq(aiModelPrice.id, priceId));
      await primaryLifecycle.database.delete(aiModel).where(eq(aiModel.id, modelId));
      await competingLifecycle.close();
      await primaryLifecycle.close();
    }
  });

  it("rejects missing and expired entitlements and rejects a task from another workspace", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleRepositoryExecutor, createWorkspaceRepositories } = await import(
      "./" + "repositories.js"
    );
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const repositories = createWorkspaceRepositories(
      createDrizzleRepositoryExecutor(lifecycle.database),
    );
    const suffix = randomUUID().replaceAll("-", "");
    const missingWorkspaceId = `test_missing_entitlement_workspace_${suffix}`;
    const expiredWorkspaceId = `test_expired_entitlement_workspace_${suffix}`;
    const ownedWorkspaceId = `test_owned_entitlement_workspace_${suffix}`;
    const otherWorkspaceId = `test_other_entitlement_workspace_${suffix}`;
    const now = new Date("2026-09-04T12:00:00.000Z");
    const missingTaskId = `test_missing_entitlement_task_${suffix}`;
    const expiredTaskId = `test_expired_entitlement_task_${suffix}`;
    const ownedTaskId = `test_owned_entitlement_task_${suffix}`;

    try {
      await lifecycle.database.insert(workspace).values([
        {
          id: missingWorkspaceId,
          name: "Missing entitlement workspace",
          slug: `missing-entitlement-${suffix}`,
          type: "personal",
        },
        {
          id: expiredWorkspaceId,
          name: "Expired entitlement workspace",
          slug: `expired-entitlement-${suffix}`,
          type: "personal",
        },
        {
          id: ownedWorkspaceId,
          name: "Owned entitlement workspace",
          slug: `owned-entitlement-${suffix}`,
          type: "personal",
        },
        {
          id: otherWorkspaceId,
          name: "Other entitlement workspace",
          slug: `other-entitlement-${suffix}`,
          type: "personal",
        },
      ]);
      await lifecycle.database.insert(entitlement).values([
        {
          expiresAt: new Date(now.getTime() - 1_000),
          id: `test_expired_entitlement_${suffix}`,
          key: "ai.reference-task",
          source: "integration-test",
          status: "active",
          workspaceId: expiredWorkspaceId,
        },
        {
          id: `test_owned_entitlement_${suffix}`,
          key: "ai.reference-task",
          source: "integration-test",
          status: "active",
          workspaceId: ownedWorkspaceId,
        },
        {
          id: `test_other_entitlement_${suffix}`,
          key: "ai.reference-task",
          source: "integration-test",
          status: "active",
          workspaceId: otherWorkspaceId,
        },
      ]);
      for (const [taskId, workspaceId] of [
        [missingTaskId, missingWorkspaceId],
        [expiredTaskId, expiredWorkspaceId],
        [ownedTaskId, ownedWorkspaceId],
      ] as const) {
        await repositories.recordTaskRun({
          id: taskId,
          input: { prompt: "entitlement" },
          status: "queued",
          taskName: "entitlement-smoke",
          workspaceId,
        });
      }

      await expect(
        repositories.authorizeAiProviderAttempt({
          estimatedUsageMicrounits: 1n,
          reservationId: `test_missing_reservation_${suffix}`,
          reservedAt: now,
          taskId: missingTaskId,
          workspaceId: missingWorkspaceId,
        }),
      ).resolves.toEqual({ reservationId: null, status: "entitlement_required" });
      await expect(
        repositories.authorizeAiProviderAttempt({
          estimatedUsageMicrounits: 1n,
          reservationId: `test_expired_reservation_${suffix}`,
          reservedAt: now,
          taskId: expiredTaskId,
          workspaceId: expiredWorkspaceId,
        }),
      ).resolves.toEqual({ reservationId: null, status: "entitlement_required" });
      await expect(
        repositories.authorizeAiProviderAttempt({
          estimatedUsageMicrounits: 1n,
          reservationId: `test_cross_workspace_reservation_${suffix}`,
          reservedAt: now,
          taskId: ownedTaskId,
          workspaceId: otherWorkspaceId,
        }),
      ).rejects.toThrow("AI budget reservation task is not owned by this workspace");
    } finally {
      for (const workspaceId of [
        missingWorkspaceId,
        expiredWorkspaceId,
        ownedWorkspaceId,
        otherWorkspaceId,
      ]) {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("keeps a concurrent older Stripe grant from overwriting a newer revocation", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleRepositoryExecutor, createWorkspaceRepositories } = await import(
      "./" + "repositories.js"
    );
    const primaryLifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const competingLifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const repositories = createWorkspaceRepositories(
      createDrizzleRepositoryExecutor(primaryLifecycle.database),
    );
    const competingRepositories = createWorkspaceRepositories(
      createDrizzleRepositoryExecutor(competingLifecycle.database),
    );
    const suffix = randomUUID().replaceAll("-", "");
    const workspaceId = `test_stripe_workspace_${suffix}`;
    const subscriptionId = `test_stripe_subscription_${suffix}`;
    const customerId = `test_stripe_customer_${suffix}`;
    const olderOccurredAt = new Date("2026-09-04T12:00:00.000Z");
    const newerOccurredAt = new Date("2026-09-04T12:01:00.000Z");

    try {
      await primaryLifecycle.database.insert(workspace).values({
        id: workspaceId,
        name: "Stripe concurrency workspace",
        slug: `stripe-concurrency-${suffix}`,
        type: "personal",
      });
      const olderGrant = {
        customerId,
        entitlement: "ai.reference-task",
        entitlementStatus: "active" as const,
        eventId: `test_stripe_older_grant_${suffix}`,
        eventType: "invoice.paid",
        occurredAt: olderOccurredAt,
        payload: { id: `test_stripe_older_grant_${suffix}`, type: "invoice.paid" },
        priceId: "price_monthly",
        subscriptionId,
        verifiedAt: newerOccurredAt,
        workspaceId,
      };
      const newerRevocation = {
        customerId,
        entitlement: "ai.reference-task",
        entitlementStatus: "inactive" as const,
        eventId: `test_stripe_newer_revoke_${suffix}`,
        eventType: "customer.subscription.deleted",
        occurredAt: newerOccurredAt,
        payload: {
          id: `test_stripe_newer_revoke_${suffix}`,
          type: "customer.subscription.deleted",
        },
        priceId: "price_monthly",
        subscriptionId,
        verifiedAt: newerOccurredAt,
        workspaceId,
      };

      const [grantResult, revocationResult] = await Promise.all([
        repositories.applyStripeBillingEvent(olderGrant),
        competingRepositories.applyStripeBillingEvent(newerRevocation),
      ]);

      expect(grantResult).toEqual(
        expect.objectContaining({
          disposition: expect.stringMatching(/^(processed|stale)$/),
          workspaceId,
        }),
      );
      expect(revocationResult).toEqual({ disposition: "processed", workspaceId });
      const [storedEntitlement] = await primaryLifecycle.database
        .select({ status: entitlement.status, workspaceId: entitlement.workspaceId })
        .from(entitlement)
        .where(eq(entitlement.workspaceId, workspaceId));
      expect(storedEntitlement).toEqual({ status: "inactive", workspaceId });
    } finally {
      await primaryLifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      await competingLifecycle.close();
      await primaryLifecycle.close();
    }
  });

  it("lets exactly one concurrent worker claim a queued task", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleRepositoryExecutor, createWorkspaceRepositories } = await import(
      "./" + "repositories.js"
    );
    const primaryLifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const competingLifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const repositories = createWorkspaceRepositories(
      createDrizzleRepositoryExecutor(primaryLifecycle.database),
    );
    const competingRepositories = createWorkspaceRepositories(
      createDrizzleRepositoryExecutor(competingLifecycle.database),
    );
    const suffix = randomUUID().replaceAll("-", "");
    const workspaceId = `test_claim_workspace_${suffix}`;
    const taskId = `test_claim_task_${suffix}`;
    const now = new Date("2026-09-04T12:00:00.000Z");

    try {
      await primaryLifecycle.database.insert(workspace).values({
        id: workspaceId,
        name: "Claim concurrency workspace",
        slug: `claim-concurrency-${suffix}`,
        type: "personal",
      });
      await repositories.recordTaskRun({
        id: taskId,
        input: { prompt: "claim" },
        status: "queued",
        taskName: "claim-smoke",
        workspaceId,
      });

      const [firstClaim, secondClaim] = await Promise.all([
        repositories.markTaskRunRunning({ startedAt: now, taskId, workspaceId }),
        competingRepositories.markTaskRunRunning({ startedAt: now, taskId, workspaceId }),
      ]);

      expect([firstClaim, secondClaim].filter((claim) => claim !== null)).toHaveLength(1);
      expect([firstClaim, secondClaim]).toContainEqual({
        completedAt: null,
        id: taskId,
        result: null,
        status: "running",
        workspaceId,
      });
      await expect(repositories.readTaskResult({ taskId, workspaceId })).resolves.toEqual({
        completedAt: null,
        id: taskId,
        result: null,
        status: "running",
        workspaceId,
      });
    } finally {
      await primaryLifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      await competingLifecycle.close();
      await primaryLifecycle.close();
    }
  });
});
