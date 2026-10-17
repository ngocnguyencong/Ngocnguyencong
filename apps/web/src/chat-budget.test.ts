import type {
  AiExecutionResult,
  AiProviderAttemptHooks,
  AvailableModel,
  TokenUsage,
  WorkspaceAiContext,
} from "@supastack/ai";
import { createModelPrice, WorkspaceBudgetExceededError } from "@supastack/ai";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { completeBudgetedChat, type ChatBudgetDependencies } from "./chat-budget";

const price = createModelPrice({
  cachedInputMicrounitsPerMillionTokens: 0n,
  currency: "USD",
  effectiveFrom: "2026-09-03T00:00:00.000Z",
  inputMicrounitsPerMillionTokens: 1_000_000n,
  model: "fake-smart",
  modelVersion: "1",
  outputMicrounitsPerMillionTokens: 2_000_000n,
  priceId: "fake-smart:1:2026-09-03",
  provider: "fake",
});
const model = { model: "fake-smart", modelVersion: "1", price, provider: "fake" } as AvailableModel;
const completion = {
  attemptedModelIds: ["fake-smart"],
  keyMode: "platform",
  model,
  text: "Hello back",
  usage: {
    cachedInputTokens: 0n,
    costMicrounits: 3_000n,
    inputTokens: 1n,
    outputTokens: 1n,
    priceId: price.priceId,
  },
  workspaceId: "ws_1",
} as AiExecutionResult;
const context: WorkspaceAiContext = {
  budget: { limitMicrounits: 5_000_000n, spentMicrounits: 0n },
  keyMode: "platform",
  workspaceId: "ws_1",
};

function dependencies(status: "authorized" | "budget_exceeded" = "authorized") {
  const providerCall = vi.fn();
  const repositories = {
    appendAiUsage: vi.fn(async () => ({})),
    authorizeAiProviderAttempt: vi.fn(async () => ({
      reservationId: status === "authorized" ? "hold_1" : null,
      status,
    })),
    markTaskRunFailed: vi.fn(async () => ({})),
    persistTaskResult: vi.fn(async () => ({ status: "completed" })),
    recordTaskRun: vi.fn(async () => ({})),
    settleAiBudgetReservation: vi.fn(async () => ({})),
  };
  const router = {
    complete: vi.fn(
      async (
        request: {
          estimatedUsage?: TokenUsage;
          signal?: AbortSignal;
          workspace: WorkspaceAiContext;
        },
        hooks?: AiProviderAttemptHooks,
      ) => {
        await hooks?.beforeProviderAttempt?.({
          attemptNumber: 1,
          ...(request.estimatedUsage === undefined
            ? {}
            : { estimatedUsage: request.estimatedUsage }),
          model,
          workspaceId: request.workspace.workspaceId,
        });
        providerCall();
        return completion;
      },
    ),
  };
  const injected = {
    createTaskId: () => "chat_1",
    now: () => new Date("2026-09-27T12:00:00.000Z"),
    repositories,
    resolveWorkspaceAiContext: async () => context,
    router,
  } as unknown as ChatBudgetDependencies;
  return { injected, providerCall, repositories, router };
}

const input = { alias: "fast" as const, prompt: "Hello", requirements: {}, workspaceId: "ws_1" };

describe("budgeted synchronous chat", () => {
  it("rejects a platform budget denial before the provider is called", async () => {
    const { injected, providerCall, repositories } = dependencies("budget_exceeded");

    await expect(completeBudgetedChat(input, injected)).rejects.toBeInstanceOf(
      WorkspaceBudgetExceededError,
    );
    expect(providerCall).not.toHaveBeenCalled();
    expect(repositories.appendAiUsage).not.toHaveBeenCalled();
  });

  it("records actual usage and settles the reserved cost after completion", async () => {
    const { injected, providerCall, repositories } = dependencies();

    await expect(completeBudgetedChat(input, injected)).resolves.toBe(completion);
    expect(providerCall).toHaveBeenCalledTimes(1);
    expect(repositories.recordTaskRun).toHaveBeenCalledWith(
      expect.objectContaining({ id: "chat_1", workspaceId: "ws_1" }),
    );
    expect(repositories.appendAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ costMicrounits: 3_000n, workspaceId: "ws_1" }),
    );
    expect(repositories.settleAiBudgetReservation).toHaveBeenCalledWith(
      expect.objectContaining({ actualCostMicrounits: 3_000n, reservationId: "hold_1" }),
    );
  });

  it("releases earlier attempt holds after the winning completion", async () => {
    const { injected, repositories, router } = dependencies();
    repositories.authorizeAiProviderAttempt
      .mockResolvedValueOnce({ reservationId: "hold_1", status: "authorized" })
      .mockResolvedValueOnce({ reservationId: "hold_2", status: "authorized" });
    router.complete.mockImplementation(async (request, hooks) => {
      for (const attemptNumber of [1, 2]) {
        await hooks?.beforeProviderAttempt?.({
          attemptNumber,
          ...(request.estimatedUsage === undefined
            ? {}
            : { estimatedUsage: request.estimatedUsage }),
          model,
          workspaceId: request.workspace.workspaceId,
        });
      }
      return completion;
    });

    await completeBudgetedChat(input, injected);

    expect(repositories.settleAiBudgetReservation).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: "hold_1", actualCostMicrounits: 0n }),
    );
    expect(repositories.settleAiBudgetReservation).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: "hold_2", actualCostMicrounits: 3_000n }),
    );
  });

  it("keeps the winning hold when actual usage cannot be recorded", async () => {
    const { injected, repositories } = dependencies();
    repositories.appendAiUsage.mockRejectedValue(new Error("database unavailable"));

    await expect(completeBudgetedChat(input, injected)).rejects.toThrow("database unavailable");

    expect(repositories.settleAiBudgetReservation).not.toHaveBeenCalled();
    expect(repositories.markTaskRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "chat_1", workspaceId: "ws_1" }),
    );
  });

  it("forwards the request signal through the budget reservation path", async () => {
    const { injected, router } = dependencies();
    const controller = new AbortController();

    await completeBudgetedChat({ ...input, signal: controller.signal }, injected);

    expect(router.complete).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
      expect.any(Object),
    );
  });

  it("releases an authorized budget hold after provider cancellation", async () => {
    const { injected, repositories, router } = dependencies();
    const controller = new AbortController();
    router.complete.mockImplementation(async (_request, hooks) => {
      await hooks?.beforeProviderAttempt?.({
        attemptNumber: 1,
        estimatedUsage: { inputTokens: 2n, outputTokens: 8192n },
        model,
        workspaceId: "ws_1",
      });
      controller.abort();
      throw Object.assign(new Error("cancelled"), { name: "AbortError" });
    });

    await expect(
      completeBudgetedChat({ ...input, signal: controller.signal }, injected),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(repositories.settleAiBudgetReservation).toHaveBeenCalledWith(
      expect.objectContaining({ actualCostMicrounits: 0n, reservationId: "hold_1" }),
    );
    expect(repositories.markTaskRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "chat_1", workspaceId: "ws_1" }),
    );
  });
});
