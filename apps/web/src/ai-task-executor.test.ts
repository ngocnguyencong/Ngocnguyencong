import {
  AiProviderError,
  FakeAiProvider,
  ModelRouter,
  createModelPrice,
  type AvailableModel,
} from "@supastack/ai";
import { LocalOutboxEmailSender } from "@supastack/email";
import type { TransactionalEmailDeliveryRecord } from "@supastack/db";
import { describe, expect, it, vi } from "vitest";

import {
  AiTaskExecutionError,
  ProductionAiTaskPayloadError,
  createProductionAiTaskExecutor,
  parseTriggeredAiTaskPayload,
  type ProductionAiTaskExecutorDependencies,
} from "./ai-task-executor.js";

const model: AvailableModel = {
  capabilities: { maxContext: 128_000, structuredOutput: true, tools: true, vision: false },
  id: "fake-smart",
  model: "fake-smart",
  modelVersion: "1",
  price: createModelPrice({
    cachedInputMicrounitsPerMillionTokens: 100_000n,
    currency: "USD",
    effectiveFrom: "2026-09-04T00:00:00.000Z",
    inputMicrounitsPerMillionTokens: 1_000_000n,
    model: "fake-smart",
    modelVersion: "1",
    outputMicrounitsPerMillionTokens: 2_000_000n,
    priceId: "price_fake_smart",
    provider: "fake",
  }),
  provider: "fake",
  ranking: { cheap: 1, fast: 1, smart: 1 },
};

function createDependencies() {
  const provider = new FakeAiProvider("fake");
  const router = new ModelRouter({ models: [model], providers: [provider] });
  const email = new LocalOutboxEmailSender();

  const dependencies: ProductionAiTaskExecutorDependencies = {
    createId: (kind: string) => `${kind}_123`,
    email,
    emailProvider: "local",
    now: () => new Date("2026-09-04T12:00:00.000Z"),
    repositories: {
      appendAiUsage: vi.fn(async (input) => input),
      listTransactionalEmailDeliveries: vi.fn(async () => []),
      authorizeAiProviderAttempt: vi.fn(async (input) => ({
        reservationId: input.reservationId,
        status: "authorized" as const,
      })),
      markTaskRunFailed: vi.fn(async () => null),
      markTaskRunRunning: vi.fn(async (input) => ({
        completedAt: null,
        id: input.taskId,
        result: null,
        status: "running",
        workspaceId: input.workspaceId,
      })),
      persistTaskResult: vi.fn(async (input) => ({
        completedAt: input.completedAt,
        id: input.taskId,
        result: input.result,
        status: "completed",
        workspaceId: input.workspaceId,
      })),
      recordTransactionalEmailDelivery: vi.fn(async (input) => input),
      settleAiBudgetReservation: vi.fn(async () => null),
    },
    router,
  };

  return { dependencies, email, provider };
}

const payload = {
  alias: "smart" as const,
  completionEmailTo: "owner@example.test",
  prompt: "Summarize this note.",
  requirements: { minContext: 32_000, structuredOutput: true },
  taskId: "task_123",
  workspaceId: "workspace-a",
};

describe("production AI task executor", () => {
  it("recovers only missing completion delivery after a send outage and skips recorded delivery", async () => {
    const { dependencies, email, provider } = createDependencies();
    let status = "queued";
    const deliveries: TransactionalEmailDeliveryRecord[] = [];
    const repositories = {
      ...dependencies.repositories,
      readTaskResult: vi.fn(async () => ({ status })),
      persistTaskResult: vi.fn(async () => {
        status = "completed";
        return { status };
      }),
      listTransactionalEmailDeliveries: vi.fn(async () => deliveries),
      recordTransactionalEmailDelivery: vi.fn(async (input: TransactionalEmailDeliveryRecord) => {
        deliveries.push(input);
        return input;
      }),
    };
    dependencies.repositories = repositories;
    const send = vi.spyOn(email, "send").mockRejectedValueOnce(new Error("private smtp error"));
    const executor = createProductionAiTaskExecutor(dependencies);

    await expect(executor.run(payload)).rejects.toThrow(AiTaskExecutionError);
    expect(status).toBe("completed");
    expect(deliveries).toHaveLength(0);
    expect(repositories.markTaskRunFailed).not.toHaveBeenCalled();

    await expect(executor.run(payload)).resolves.toMatchObject({
      completionEmail: { deliveryId: "email_1", status: "accepted" },
    });
    await executor.run(payload);
    expect(send).toHaveBeenCalledTimes(2);
    expect(deliveries).toHaveLength(1);
    expect(repositories.listTransactionalEmailDeliveries).toHaveBeenCalledWith({
      workspaceId: payload.workspaceId,
    });
    expect(provider.requests).toHaveLength(1);
    expect(repositories.markTaskRunRunning).toHaveBeenCalledTimes(1);
    expect(repositories.authorizeAiProviderAttempt).toHaveBeenCalledTimes(1);
    expect(repositories.appendAiUsage).toHaveBeenCalledTimes(1);
    expect(repositories.settleAiBudgetReservation).toHaveBeenCalledTimes(1);
    expect(repositories.persistTaskResult).toHaveBeenCalledTimes(1);
  });

  it.each(["running", "failed"])(
    "does not repeat AI execution on a %s task retry",
    async (status) => {
      const { dependencies, provider } = createDependencies();
      const send = vi.spyOn(dependencies.email, "send");
      dependencies.repositories = {
        ...dependencies.repositories,
        readTaskResult: vi.fn(async () => ({ status })),
        markTaskRunRunning: vi.fn(async () => null),
      };
      await expect(createProductionAiTaskExecutor(dependencies).run(payload)).rejects.toThrow(
        AiTaskExecutionError,
      );
      expect(send).not.toHaveBeenCalled();
      expect(provider.requests).toHaveLength(0);
      expect(dependencies.repositories.authorizeAiProviderAttempt).not.toHaveBeenCalled();
    },
  );

  it("routes, persists immutable usage/result, and records a transactional completion email", async () => {
    const { dependencies, email, provider } = createDependencies();
    const executor = createProductionAiTaskExecutor(dependencies);

    await expect(executor.run(payload)).resolves.toEqual({
      completionEmail: { deliveryId: "email_1", status: "accepted" },
      status: "completed",
      taskId: "task_123",
      workspaceId: "workspace-a",
    });

    expect(provider.requests).toEqual([
      expect.objectContaining({
        input: { prompt: "Summarize this note." },
        workspace: expect.objectContaining({ workspaceId: "workspace-a" }),
      }),
    ]);
    expect(dependencies.repositories.markTaskRunRunning).toHaveBeenCalledWith({
      startedAt: new Date("2026-09-04T12:00:00.000Z"),
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
    expect(dependencies.repositories.authorizeAiProviderAttempt).toHaveBeenCalledWith({
      estimatedUsageMicrounits: 20500n,
      reservationId: "ai_budget:task_123:run_123:1",
      reservedAt: new Date("2026-09-04T12:00:00.000Z"),
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
    expect(dependencies.repositories.appendAiUsage).toHaveBeenCalledWith({
      cachedInputTokens: 0,
      costMicrounits: expect.any(BigInt),
      createdAt: new Date("2026-09-04T12:00:00.000Z"),
      id: "usage_task_123",
      inputTokens: 33,
      latencyMs: 0,
      model: "fake-smart",
      outputTokens: 1,
      priceId: "price_fake_smart",
      provider: "fake",
      requestId: "task_123",
      status: "completed",
      workspaceId: "workspace-a",
    });
    expect(dependencies.repositories.persistTaskResult).toHaveBeenCalledWith({
      completedAt: new Date("2026-09-04T12:00:00.000Z"),
      result: {
        model: { id: "fake-smart", model: "fake-smart", modelVersion: "1", provider: "fake" },
        text: 'fake:fake-smart:{"prompt":"Summarize this note."}',
        usage: {
          cachedInputTokens: 0,
          costMicrounits: expect.any(String),
          inputTokens: 33,
          outputTokens: 1,
          priceId: "price_fake_smart",
        },
      },
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
    expect(dependencies.repositories.settleAiBudgetReservation).toHaveBeenCalledWith({
      actualCostMicrounits: expect.any(BigInt),
      reservationId: "ai_budget:task_123:run_123:1",
      settledAt: new Date("2026-09-04T12:00:00.000Z"),
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
    await expect(
      email.getStatus({ deliveryId: "email_1", workspaceId: "workspace-a" }),
    ).resolves.toMatchObject({
      subject: "Your AI task is complete",
      to: "owner@example.test",
    });
    expect(dependencies.repositories.recordTransactionalEmailDelivery).toHaveBeenCalledWith({
      id: "email_delivery_task_123",
      provider: "local",
      providerMessageId: "email_1",
      recipient: "owner@example.test",
      sentAt: new Date("2026-09-04T12:00:00.000Z"),
      status: "accepted",
      template: "ai-task-complete",
      workspaceId: "workspace-a",
    });
  });

  it("carries the task correlationId into the completion webhook fan-out", async () => {
    const { dependencies } = createDependencies();
    const onTaskCompleted = vi.fn(async () => undefined);
    dependencies.onTaskCompleted = onTaskCompleted;
    const executor = createProductionAiTaskExecutor(dependencies);

    await executor.run({ ...payload, correlationId: "corr_req-9" });

    expect(onTaskCompleted).toHaveBeenCalledWith({
      correlationId: "corr_req-9",
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
  });

  it("omits correlationId from the completion fan-out when the payload has none", async () => {
    const { dependencies } = createDependencies();
    const onTaskCompleted = vi.fn(async () => undefined);
    dependencies.onTaskCompleted = onTaskCompleted;
    const executor = createProductionAiTaskExecutor(dependencies);

    await executor.run(payload);

    expect(onTaskCompleted).toHaveBeenCalledWith({
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
  });

  it("marks the owned task failed without exposing a provider error", async () => {
    const { dependencies } = createDependencies();
    dependencies.router = {
      complete: async () => {
        throw new Error("secret provider failure");
      },
    };
    const executor = createProductionAiTaskExecutor(dependencies);

    const failure = await executor.run(payload).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiTaskExecutionError);
    expect((failure as Error).message).not.toContain("secret provider failure");
    expect(dependencies.repositories.markTaskRunFailed).toHaveBeenCalledWith({
      completedAt: new Date("2026-09-04T12:00:00.000Z"),
      errorCode: "ai_execution_failed",
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
  });

  it("does not call a provider after the worker-side entitlement recheck is denied", async () => {
    const { dependencies, provider } = createDependencies();
    dependencies.repositories = {
      ...dependencies.repositories,
      authorizeAiProviderAttempt: vi.fn(async () => ({
        reservationId: null,
        status: "entitlement_required" as const,
      })),
    };
    const executor = createProductionAiTaskExecutor(dependencies);

    await expect(executor.run(payload)).rejects.toThrow(AiTaskExecutionError);
    expect(provider.requests).toEqual([]);
    expect(dependencies.repositories.markTaskRunFailed).toHaveBeenCalledWith({
      completedAt: new Date("2026-09-04T12:00:00.000Z"),
      errorCode: "ai_execution_failed",
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
  });

  it("notifies the workspace when monthly AI budget is exceeded", async () => {
    const { dependencies, provider } = createDependencies();
    const onBudgetExceeded = vi.fn(async () => undefined);
    dependencies.onBudgetExceeded = onBudgetExceeded;
    dependencies.repositories = {
      ...dependencies.repositories,
      authorizeAiProviderAttempt: vi.fn(async () => ({
        reservationId: null,
        status: "budget_exceeded" as const,
      })),
    };
    const executor = createProductionAiTaskExecutor(dependencies);

    await expect(executor.run(payload)).rejects.toThrow(AiTaskExecutionError);
    expect(onBudgetExceeded).toHaveBeenCalledWith("workspace-a");
    expect(provider.requests).toEqual([]);
  });

  it("rejects provider token counts above the PostgreSQL integer maximum before persistence", async () => {
    const { dependencies } = createDependencies();
    dependencies.router = {
      complete: async () => ({
        attemptedModelIds: ["fake-smart"],
        keyMode: "platform" as const,
        model,
        text: "oversized usage",
        usage: {
          cachedInputTokens: 0n,
          costMicrounits: 1n,
          inputTokens: 2_147_483_648n,
          outputTokens: 1n,
          priceId: "price_fake_smart",
        },
        workspaceId: "workspace-a",
      }),
    };
    const executor = createProductionAiTaskExecutor(dependencies);

    await expect(executor.run(payload)).rejects.toThrow(AiTaskExecutionError);
    expect(dependencies.repositories.appendAiUsage).not.toHaveBeenCalled();
  });

  it("does not authorize or call a provider when another worker already claimed the task", async () => {
    const { dependencies, provider } = createDependencies();
    dependencies.repositories = {
      ...dependencies.repositories,
      markTaskRunRunning: vi.fn(async () => null),
    };
    const executor = createProductionAiTaskExecutor(dependencies);

    await expect(executor.run(payload)).rejects.toThrow(AiTaskExecutionError);
    expect(dependencies.repositories.authorizeAiProviderAttempt).not.toHaveBeenCalled();
    expect(dependencies.repositories.markTaskRunFailed).not.toHaveBeenCalled();
    expect(provider.requests).toEqual([]);
  });

  it("attributes usage to the successful authorization instant across a UTC month boundary", async () => {
    const { dependencies } = createDependencies();
    const instants = [
      new Date("2026-09-30T23:59:59.900Z"),
      new Date("2026-09-30T23:59:59.950Z"),
      new Date("2026-10-01T00:00:00.100Z"),
      new Date("2026-10-01T00:00:00.200Z"),
    ];
    dependencies.now = () => instants.shift() ?? new Date("2026-10-01T00:00:00.300Z");

    await createProductionAiTaskExecutor(dependencies).run(payload);

    expect(dependencies.repositories.appendAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ createdAt: new Date("2026-09-30T23:59:59.950Z") }),
    );
  });

  it("never exposes a secret-bearing completion email failure", async () => {
    const { dependencies } = createDependencies();
    dependencies.email = {
      getStatus: vi.fn(),
      send: vi.fn(async () => {
        throw new Error("smtp-password-secret");
      }),
    };

    const failure = await createProductionAiTaskExecutor(dependencies)
      .run(payload)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiTaskExecutionError);
    expect((failure as Error).message).not.toContain("smtp-password-secret");
  });

  it("rejects a Trigger payload whose nested workspace differs from its envelope", () => {
    expect(() =>
      parseTriggeredAiTaskPayload({
        input: { ...payload, workspaceId: "workspace-b" },
        workspaceId: "workspace-a",
      }),
    ).toThrow(ProductionAiTaskPayloadError);
  });

  it("carries an optional correlationId on the trigger payload and drops malformed values", () => {
    expect(
      parseTriggeredAiTaskPayload({
        input: { ...payload, correlationId: "corr_req-1" },
        workspaceId: "workspace-a",
      }).correlationId,
    ).toBe("corr_req-1");
    // Old rows and odd payloads never fail over the optional field.
    for (const bad of [42, "", "   ", null]) {
      expect(
        parseTriggeredAiTaskPayload({
          input: { ...payload, correlationId: bad },
          workspaceId: "workspace-a",
        }).correlationId,
      ).toBeUndefined();
    }
    expect(
      parseTriggeredAiTaskPayload({ input: payload, workspaceId: "workspace-a" }).correlationId,
    ).toBeUndefined();
  });

  it("releases earlier attempt holds after a retried execution succeeds", async () => {
    const { dependencies } = createDependencies();
    const provider = new FakeAiProvider("fake", [new AiProviderError("transient upstream", true)]);
    const fallbackModel: AvailableModel = {
      ...model,
      id: "fake-smart-b",
      model: "fake-smart-b",
      ranking: { cheap: 2, fast: 2, smart: 2 },
    };
    dependencies.router = new ModelRouter({
      models: [model, fallbackModel],
      providers: [provider],
    });
    const executor = createProductionAiTaskExecutor(dependencies);

    await expect(executor.run(payload)).resolves.toMatchObject({ status: "completed" });

    expect(dependencies.repositories.authorizeAiProviderAttempt).toHaveBeenCalledTimes(2);
    const usageCost = vi.mocked(dependencies.repositories.appendAiUsage).mock.calls[0]?.[0]
      .costMicrounits;
    expect(usageCost).toEqual(expect.any(BigInt));
    const settle = vi.mocked(dependencies.repositories.settleAiBudgetReservation);
    expect(settle).toHaveBeenCalledTimes(2);
    expect(settle).toHaveBeenCalledWith({
      actualCostMicrounits: usageCost,
      reservationId: "ai_budget:task_123:run_123:2",
      settledAt: new Date("2026-09-04T12:00:00.000Z"),
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
    expect(settle).toHaveBeenCalledWith({
      actualCostMicrounits: 0n,
      reservationId: "ai_budget:task_123:run_123:1",
      settledAt: new Date("2026-09-04T12:00:00.000Z"),
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
  });

  it("releases the authorized reservation when the router throws after authorization", async () => {
    const { dependencies } = createDependencies();
    dependencies.router = {
      complete: async (_input, hooks) => {
        await hooks?.beforeProviderAttempt?.({
          attemptNumber: 1,
          estimatedUsage: { inputTokens: 10n, outputTokens: 5n },
          model,
          workspaceId: payload.workspaceId,
        });
        throw new Error("secret provider outage");
      },
    };
    const executor = createProductionAiTaskExecutor(dependencies);

    const failure = await executor.run(payload).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiTaskExecutionError);
    expect(dependencies.repositories.settleAiBudgetReservation).toHaveBeenCalledWith({
      actualCostMicrounits: 0n,
      reservationId: "ai_budget:task_123:run_123:1",
      settledAt: new Date("2026-09-04T12:00:00.000Z"),
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
    expect(dependencies.repositories.markTaskRunFailed).toHaveBeenCalledWith({
      completedAt: new Date("2026-09-04T12:00:00.000Z"),
      errorCode: "ai_execution_failed",
      taskId: "task_123",
      workspaceId: "workspace-a",
    });
  });

  it("releases the authorized reservation when usage persistence fails", async () => {
    const { dependencies } = createDependencies();
    dependencies.repositories = {
      ...dependencies.repositories,
      appendAiUsage: vi.fn(async () => {
        throw new Error("usage write outage");
      }),
    };
    const executor = createProductionAiTaskExecutor(dependencies);

    await expect(executor.run(payload)).rejects.toThrow(AiTaskExecutionError);
    expect(dependencies.repositories.settleAiBudgetReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCostMicrounits: 0n,
        reservationId: "ai_budget:task_123:run_123:1",
      }),
    );
    expect(dependencies.repositories.markTaskRunFailed).toHaveBeenCalled();
  });

  it.each(["throws", "non-completed"] as const)(
    "settles the successful reservation at real cost when result persistence %s",
    async (mode) => {
      const { dependencies } = createDependencies();
      const persistTaskResult =
        mode === "throws"
          ? vi.fn(async () => {
              throw new Error("result write outage");
            })
          : vi.fn(async () => ({ status: "failed" }));
      dependencies.repositories = { ...dependencies.repositories, persistTaskResult };
      const executor = createProductionAiTaskExecutor(dependencies);

      await expect(executor.run(payload)).rejects.toThrow(AiTaskExecutionError);
      const usageCost = vi.mocked(dependencies.repositories.appendAiUsage).mock.calls[0]?.[0]
        .costMicrounits;
      const settle = vi.mocked(dependencies.repositories.settleAiBudgetReservation);
      expect(settle).toHaveBeenCalledTimes(1);
      expect(settle).toHaveBeenCalledWith(
        expect.objectContaining({
          actualCostMicrounits: usageCost,
          reservationId: "ai_budget:task_123:run_123:1",
        }),
      );
      expect(usageCost).not.toBe(0n);
      expect(dependencies.repositories.markTaskRunFailed).toHaveBeenCalled();
    },
  );

  it("resettles the winner at real cost when its first settlement fails", async () => {
    const { dependencies } = createDependencies();
    const settleAiBudgetReservation = vi
      .fn(async () => null)
      .mockRejectedValueOnce(new Error("settle outage"));
    dependencies.repositories = { ...dependencies.repositories, settleAiBudgetReservation };
    const executor = createProductionAiTaskExecutor(dependencies);

    await expect(executor.run(payload)).rejects.toThrow(AiTaskExecutionError);

    const usageCost = vi.mocked(dependencies.repositories.appendAiUsage).mock.calls[0]?.[0]
      .costMicrounits;
    expect(usageCost).not.toBe(0n);
    // Call 1 is the rejected success-path settle; call 2 is the catch's
    // retried release — both must carry the appended real cost, never 0n.
    expect(settleAiBudgetReservation).toHaveBeenCalledTimes(2);
    for (const nth of [1, 2] as const) {
      expect(settleAiBudgetReservation).toHaveBeenNthCalledWith(
        nth,
        expect.objectContaining({
          actualCostMicrounits: usageCost,
          reservationId: "ai_budget:task_123:run_123:1",
          taskId: "task_123",
          workspaceId: "workspace-a",
        }),
      );
    }
    expect(dependencies.repositories.markTaskRunFailed).toHaveBeenCalled();
  });

  it("still fails the run when releasing a leaked reservation itself fails", async () => {
    const { dependencies } = createDependencies();
    dependencies.router = {
      complete: async (_input, hooks) => {
        await hooks?.beforeProviderAttempt?.({
          attemptNumber: 1,
          estimatedUsage: { inputTokens: 10n, outputTokens: 5n },
          model,
          workspaceId: payload.workspaceId,
        });
        throw new Error("provider outage");
      },
    };
    const settleAiBudgetReservation = vi.fn(async () => {
      throw new Error("settle outage");
    });
    dependencies.repositories = {
      ...dependencies.repositories,
      settleAiBudgetReservation,
    };
    const executor = createProductionAiTaskExecutor(dependencies);

    const failure = await executor.run(payload).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiTaskExecutionError);
    expect(settleAiBudgetReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCostMicrounits: 0n,
        reservationId: "ai_budget:task_123:run_123:1",
      }),
    );
    expect((failure as Error).message).not.toContain("settle outage");
    expect(dependencies.repositories.markTaskRunFailed).toHaveBeenCalled();
  });

  it("issues fresh reservation ids when a retried run reauthorizes the task", async () => {
    // `markTaskRunRunning` only claims `queued` rows and nothing re-queues
    // today, so this back-to-back sequence is unreachable in production —
    // it pins the nonce as defense-in-depth, not a reachable collision.
    const { dependencies } = createDependencies();
    const nonces = ["run_a", "run_b"];
    dependencies.createId = () => nonces.shift() ?? "run_z";
    const executor = createProductionAiTaskExecutor(dependencies);

    await executor.run(payload);
    await executor.run(payload);

    const reservationIds = vi
      .mocked(dependencies.repositories.authorizeAiProviderAttempt)
      .mock.calls.map(([input]) => input.reservationId);
    expect(reservationIds).toEqual(["ai_budget:task_123:run_a:1", "ai_budget:task_123:run_b:1"]);
  });
});
