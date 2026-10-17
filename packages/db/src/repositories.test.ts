import { describe, expect, it } from "vitest";

const repositoriesModule = await import("./" + "repositories.js").catch(() => null);

type RepositoryCommand = {
  input: Record<string, unknown>;
  kind: string;
};

function createExecutor(resultByKind: Record<string, unknown>) {
  const commands: RepositoryCommand[] = [];

  return {
    commands,
    executor: {
      execute: async (command: RepositoryCommand) => {
        commands.push(command);
        return resultByKind[command.kind] ?? null;
      },
    },
  };
}

describe("workspace repositories", () => {
  it("exports the workspace repository and Drizzle executor factories", () => {
    expect(repositoriesModule).toEqual(
      expect.objectContaining({
        createDrizzleRepositoryExecutor: expect.any(Function),
        createWorkspaceRepositories: expect.any(Function),
      }),
    );
  });

  it("creates, completes, and reads a task within its workspace", async () => {
    if (!repositoriesModule) {
      return;
    }

    const completedAt = new Date("2026-09-03T12:00:00.000Z");
    const task = {
      completedAt,
      id: "task_01",
      result: { answer: "done" },
      status: "completed",
      workspaceId: "workspace_01",
    };
    const queuedTask = {
      completedAt: null,
      id: "task_01",
      result: null,
      status: "queued",
      workspaceId: "workspace_01",
    };
    const { commands, executor } = createExecutor({
      persistTaskResult: task,
      readTaskResult: task,
      recordTaskRun: queuedTask,
    });
    const repositories = repositoriesModule.createWorkspaceRepositories(executor);

    await expect(
      repositories.recordTaskRun({
        id: "task_01",
        input: { prompt: "hello" },
        status: "queued",
        taskName: "ai.generate",
        workspaceId: "workspace_01",
      }),
    ).resolves.toEqual(queuedTask);
    await expect(
      repositories.persistTaskResult({
        completedAt,
        result: { answer: "done" },
        taskId: "task_01",
        workspaceId: "workspace_01",
      }),
    ).resolves.toEqual(task);
    await expect(
      repositories.readTaskResult({ taskId: "task_01", workspaceId: "workspace_01" }),
    ).resolves.toEqual(task);
    expect(commands.map(({ input, kind }) => ({ kind, workspaceId: input.workspaceId }))).toEqual([
      { kind: "recordTaskRun", workspaceId: "workspace_01" },
      { kind: "persistTaskResult", workspaceId: "workspace_01" },
      { kind: "readTaskResult", workspaceId: "workspace_01" },
    ]);
  });

  it("binds a provider run and transitions only the owned task state", async () => {
    if (!repositoriesModule) {
      return;
    }

    const running = {
      completedAt: null,
      id: "task_01",
      result: null,
      status: "running",
      workspaceId: "workspace_01",
    };
    const failed = {
      completedAt: new Date("2026-09-04T12:02:00.000Z"),
      id: "task_01",
      result: null,
      status: "failed",
      workspaceId: "workspace_01",
    };
    const { commands, executor } = createExecutor({
      markTaskRunFailed: failed,
      markTaskRunRunning: running,
      setTaskRunProviderRunId: running,
    });
    const repositories = repositoriesModule.createWorkspaceRepositories(executor);

    await expect(
      repositories.setTaskRunProviderRunId({
        providerRunId: "run_01",
        taskId: "task_01",
        workspaceId: "workspace_01",
      }),
    ).resolves.toEqual(running);
    await expect(
      repositories.markTaskRunRunning({
        startedAt: new Date("2026-09-04T12:01:00.000Z"),
        taskId: "task_01",
        workspaceId: "workspace_01",
      }),
    ).resolves.toEqual(running);
    await expect(
      repositories.markTaskRunFailed({
        completedAt: new Date("2026-09-04T12:02:00.000Z"),
        errorCode: "ai_execution_failed",
        taskId: "task_01",
        workspaceId: "workspace_01",
      }),
    ).resolves.toEqual(failed);

    expect(commands.map(({ input, kind }) => ({ kind, workspaceId: input.workspaceId }))).toEqual([
      { kind: "setTaskRunProviderRunId", workspaceId: "workspace_01" },
      { kind: "markTaskRunRunning", workspaceId: "workspace_01" },
      { kind: "markTaskRunFailed", workspaceId: "workspace_01" },
    ]);
  });

  it("forwards worker authorization and successful budget settlement with workspace identity", async () => {
    if (!repositoriesModule) {
      return;
    }

    const authorization = { reservationId: "ai_budget:task_01:1", status: "authorized" };
    const { commands, executor } = createExecutor({
      authorizeAiProviderAttempt: authorization,
      settleAiBudgetReservation: null,
    });
    const repositories = repositoriesModule.createWorkspaceRepositories(executor);
    const authorizationInput = {
      estimatedUsageMicrounits: 5_000n,
      reservationId: "ai_budget:task_01:1",
      reservedAt: new Date("2026-09-04T12:01:00.000Z"),
      taskId: "task_01",
      workspaceId: "workspace_01",
    };
    const settlementInput = {
      actualCostMicrounits: 25n,
      reservationId: "ai_budget:task_01:1",
      settledAt: new Date("2026-09-04T12:02:00.000Z"),
      taskId: "task_01",
      workspaceId: "workspace_01",
    };

    await expect(repositories.authorizeAiProviderAttempt(authorizationInput)).resolves.toEqual(
      authorization,
    );
    await expect(repositories.settleAiBudgetReservation(settlementInput)).resolves.toBeNull();
    expect(commands).toEqual([
      { input: authorizationInput, kind: "authorizeAiProviderAttempt" },
      { input: settlementInput, kind: "settleAiBudgetReservation" },
    ]);
  });

  it("appends usage with the exact immutable price-row reference", async () => {
    if (!repositoriesModule) {
      return;
    }

    const usage = {
      cachedInputTokens: 0,
      costMicrounits: 25n,
      createdAt: new Date("2026-09-04T23:59:59.000Z"),
      id: "usage_01",
      inputTokens: 10,
      latencyMs: 100,
      model: "gpt-test",
      outputTokens: 4,
      priceId: "price_2026_09",
      provider: "fake",
      requestId: "request_01",
      status: "completed",
      workspaceId: "workspace_01",
    };
    const { commands, executor } = createExecutor({ appendAiUsage: usage, listAiUsage: [usage] });
    const repositories = repositoriesModule.createWorkspaceRepositories(executor);

    await expect(repositories.appendAiUsage(usage)).resolves.toEqual(usage);
    await expect(repositories.listAiUsage({ workspaceId: "workspace_01" })).resolves.toEqual([
      usage,
    ]);
    expect(commands[0]).toEqual({ kind: "appendAiUsage", input: usage });
    expect(commands[1]).toEqual({ kind: "listAiUsage", input: { workspaceId: "workspace_01" } });
  });

  it("records, reads, and advances webhook ledger state within its workspace", async () => {
    if (!repositoriesModule) {
      return;
    }

    const verifiedAt = new Date("2026-09-03T12:00:00.000Z");
    const processedAt = new Date("2026-09-03T12:01:00.000Z");
    const event = {
      id: "webhook_01",
      payload: { type: "invoice.paid" },
      processedAt: null,
      provider: "stripe",
      providerEventId: "evt_01",
      status: "received",
      verifiedAt,
      workspaceId: "workspace_01",
    };
    const processed = { ...event, processedAt, status: "processed" };
    const { commands, executor } = createExecutor({
      markWebhookProcessed: processed,
      readWebhook: event,
      recordWebhook: { event, isDuplicate: false },
    });
    const repositories = repositoriesModule.createWorkspaceRepositories(executor);

    await expect(
      repositories.recordWebhook({ ...event, processedAt: undefined, status: undefined }),
    ).resolves.toEqual({
      event,
      isDuplicate: false,
    });
    await expect(
      repositories.markWebhookProcessed({
        processedAt,
        provider: "stripe",
        providerEventId: "evt_01",
        status: "processed",
        workspaceId: "workspace_01",
      }),
    ).resolves.toEqual(processed);
    await expect(
      repositories.readWebhook({
        provider: "stripe",
        providerEventId: "evt_01",
        workspaceId: "workspace_01",
      }),
    ).resolves.toEqual(event);
    expect(commands.map(({ input, kind }) => ({ kind, workspaceId: input.workspaceId }))).toEqual([
      { kind: "recordWebhook", workspaceId: "workspace_01" },
      { kind: "markWebhookProcessed", workspaceId: "workspace_01" },
      { kind: "readWebhook", workspaceId: "workspace_01" },
    ]);
  });

  it("applies a Stripe lifecycle event atomically and reads only its workspace customer", async () => {
    if (!repositoriesModule) {
      return;
    }

    const applied = { disposition: "processed", workspaceId: "workspace_01" };
    const customer = {
      provider: "stripe",
      providerCustomerId: "cus_01",
      workspaceId: "workspace_01",
    };
    const { commands, executor } = createExecutor({
      applyStripeBillingEvent: applied,
      readBillingCustomer: customer,
    });
    const repositories = repositoriesModule.createWorkspaceRepositories(executor);
    const event = {
      customerId: "cus_01",
      entitlement: "ai.reference-task",
      entitlementStatus: "active" as const,
      eventId: "evt_01",
      eventType: "customer.subscription.updated",
      occurredAt: new Date("2026-09-04T11:59:00.000Z"),
      payload: { id: "evt_01", type: "customer.subscription.updated" },
      priceId: "price_monthly",
      subscriptionId: "sub_01",
      verifiedAt: new Date("2026-09-04T12:00:00.000Z"),
      workspaceId: "workspace_01",
    };

    await expect(repositories.applyStripeBillingEvent(event)).resolves.toEqual(applied);
    await expect(
      repositories.readBillingCustomer({ provider: "stripe", workspaceId: "workspace_01" }),
    ).resolves.toEqual(customer);
    expect(commands).toEqual([
      { input: event, kind: "applyStripeBillingEvent" },
      {
        input: { provider: "stripe", workspaceId: "workspace_01" },
        kind: "readBillingCustomer",
      },
    ]);
  });

  it("rejects stale Stripe grants while allowing an equal-time revocation", () => {
    if (!repositoriesModule) {
      return;
    }

    const storedOccurredAt = new Date("2026-09-04T12:00:00.000Z");
    expect(
      repositoriesModule.shouldApplyStripeLifecycleEvent({
        incomingOccurredAt: new Date("2026-09-04T11:59:59.000Z"),
        incomingStatus: "active",
        storedOccurredAt,
        storedStatus: "inactive",
      }),
    ).toBe(false);
    expect(
      repositoriesModule.shouldApplyStripeLifecycleEvent({
        incomingOccurredAt: storedOccurredAt,
        incomingStatus: "active",
        storedOccurredAt,
        storedStatus: "inactive",
      }),
    ).toBe(false);
    expect(
      repositoriesModule.shouldApplyStripeLifecycleEvent({
        incomingOccurredAt: storedOccurredAt,
        incomingStatus: "inactive",
        storedOccurredAt,
        storedStatus: "active",
      }),
    ).toBe(true);
  });

  it("persists and lists transactional email deliveries within their workspace", async () => {
    if (!repositoriesModule) {
      return;
    }

    const delivery = {
      id: "delivery_01",
      provider: "resend",
      providerMessageId: "message_01",
      recipient: "person@example.com",
      sentAt: new Date("2026-09-03T12:00:00.000Z"),
      status: "sent",
      template: "task-complete",
      workspaceId: "workspace_01",
    };
    const { commands, executor } = createExecutor({
      listTransactionalEmailDeliveries: [delivery],
      recordTransactionalEmailDelivery: delivery,
    });
    const repositories = repositoriesModule.createWorkspaceRepositories(executor);

    await expect(repositories.recordTransactionalEmailDelivery(delivery)).resolves.toEqual(
      delivery,
    );
    await expect(
      repositories.listTransactionalEmailDeliveries({ workspaceId: "workspace_01" }),
    ).resolves.toEqual([delivery]);
    expect(commands.map(({ input, kind }) => ({ kind, workspaceId: input.workspaceId }))).toEqual([
      { kind: "recordTransactionalEmailDelivery", workspaceId: "workspace_01" },
      { kind: "listTransactionalEmailDeliveries", workspaceId: "workspace_01" },
    ]);
  });
});
