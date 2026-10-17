import {
  DEFAULT_AGENT_MAX_STEPS,
  defineTool,
  type AgentRunResult,
  type AgentRunner,
  type ToolContext,
  type ToolScope,
} from "@supastack/agents";
import type { AvailableModel, WorkspaceAiContext } from "@supastack/ai";
import { calculateModelCost, createModelPrice, WorkspaceBudgetExceededError } from "@supastack/ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import {
  AgentByokUnsupportedError,
  AgentModelCapabilityError,
  AgentModelNotFoundError,
  runBudgetedAgent,
  type AgentBudgetDependencies,
  type BudgetedAgentRunInput,
} from "./agent-budget";
import { estimateConservativeUsage } from "./ai-task-executor";

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
const model = {
  capabilities: { maxContext: 128_000, structuredOutput: true, tools: true, vision: false },
  id: "catalog-fake-smart",
  model: "fake-smart",
  modelVersion: "1",
  price,
  provider: "fake",
  ranking: { cheap: 1, fast: 1, smart: 1 },
} as AvailableModel;
const context: WorkspaceAiContext = {
  budget: { limitMicrounits: 50_000_000n, spentMicrounits: 0n },
  keyMode: "platform",
  workspaceId: "ws_1",
};
const readTool = defineTool({
  description: "Read a workspace record.",
  execute: async () => ({}),
  inputSchema: z.object({}),
  name: "read_thing",
  scope: "read",
  title: "Read thing",
});
const writeTool = defineTool({
  description: "Write a workspace record.",
  execute: async () => ({}),
  inputSchema: z.object({}),
  name: "write_thing",
  scope: "write",
  title: "Write thing",
});
const runResult = {
  framework: "ai-sdk",
  text: "The workspace summary.",
  toolCalls: [{ input: {}, name: "read_thing" }],
  usage: { inputTokens: 100, outputTokens: 50 },
} as AgentRunResult;

const input: BudgetedAgentRunInput = {
  modelId: "catalog-fake-smart",
  prompt: "Summarize the workspace",
  scopes: ["read"] as const satisfies readonly ToolScope[],
  userId: "user_1",
  workspaceId: "ws_1",
};

const DEFAULT_INSTRUCTIONS =
  "You are a workspace assistant. Use the available workspace tools to answer the request.";

function estimatedReservationCost(maxSteps = DEFAULT_AGENT_MAX_STEPS) {
  const base = estimateConservativeUsage(input.prompt);
  const steps = BigInt(maxSteps);
  return calculateModelCost(price, {
    inputTokens:
      (base.inputTokens + BigInt(Buffer.byteLength(DEFAULT_INSTRUCTIONS, "utf8"))) * steps,
    outputTokens: base.outputTokens * steps,
  }).totalCostMicrounits;
}

function dependencies(
  status: "authorized" | "budget_exceeded" | "entitlement_required" = "authorized",
) {
  const order: string[] = [];
  const repositories = {
    appendAiUsage: vi.fn(async () => {
      order.push("appendAiUsage");
      return {};
    }),
    authorizeAiProviderAttempt: vi.fn(async () => {
      order.push("authorize");
      return {
        reservationId: status === "authorized" ? "hold_1" : null,
        status,
      };
    }),
    markTaskRunFailed: vi.fn(async () => ({})),
    persistTaskResult: vi.fn(async (): Promise<{ status: string } | null> => {
      order.push("persistTaskResult");
      return { status: "completed" };
    }),
    recordTaskRun: vi.fn(async () => {
      order.push("recordTaskRun");
      return {};
    }),
    settleAiBudgetReservation: vi.fn(async () => {
      order.push("settle");
      return {};
    }),
  };
  const runner = {
    framework: "ai-sdk",
    run: vi.fn(async () => {
      order.push("run");
      return runResult;
    }),
  } as unknown as AgentRunner & { run: ReturnType<typeof vi.fn> };
  const injected = {
    createRunner: vi.fn(async () => runner),
    createTaskId: () => "agent_1",
    findModel: vi.fn(async () => model),
    now: () => new Date("2026-10-03T12:00:00.000Z"),
    repositories,
    resolveWorkspaceAiContext: vi.fn(async () => context),
    tools: [readTool, writeTool],
  } as unknown as AgentBudgetDependencies;
  return { injected, order, repositories, runner };
}

describe("budgeted agent run", () => {
  it("authorizes, runs, records usage, settles at actual cost, and persists in order", async () => {
    const { injected, order, repositories, runner } = dependencies();

    const expectedCost = calculateModelCost(price, {
      inputTokens: 100n,
      outputTokens: 50n,
    }).totalCostMicrounits;

    const outcome = await runBudgetedAgent(input, injected);

    expect(outcome.result).toBe(runResult);
    expect(outcome.taskId).toBe("agent_1");
    expect(outcome.costMicrounits).toBe(expectedCost);
    expect(order).toEqual([
      "recordTaskRun",
      "authorize",
      "run",
      "appendAiUsage",
      "settle",
      "persistTaskResult",
    ]);
    expect(injected.findModel).toHaveBeenCalledWith("catalog-fake-smart");
    expect(repositories.recordTaskRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "agent_1",
        status: "running",
        taskName: "agent.run",
        workspaceId: "ws_1",
      }),
    );
    expect(repositories.authorizeAiProviderAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        estimatedUsageMicrounits: estimatedReservationCost(),
        reservationId: "ai_budget:agent_1:agent",
        taskId: "agent_1",
        workspaceId: "ws_1",
      }),
    );
    expect(repositories.appendAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        costMicrounits: expectedCost,
        id: "usage_agent_1",
        inputTokens: 100,
        model: "fake-smart",
        outputTokens: 50,
        priceId: price.priceId,
        provider: "fake",
        requestId: "agent_1",
        status: "completed",
        workspaceId: "ws_1",
      }),
    );
    expect(repositories.settleAiBudgetReservation).toHaveBeenCalledWith(
      expect.objectContaining({ actualCostMicrounits: expectedCost, reservationId: "hold_1" }),
    );
    expect(repositories.persistTaskResult).toHaveBeenCalledWith(
      expect.objectContaining({
        result: {
          model: { id: "catalog-fake-smart", model: "fake-smart", provider: "fake" },
          source: "agent-run",
          text: runResult.text,
          toolCallCount: 1,
          toolNames: ["read_thing"],
        },
        taskId: "agent_1",
        workspaceId: "ws_1",
      }),
    );
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it("rejects a platform budget denial before the runner is created", async () => {
    const { injected, repositories } = dependencies("budget_exceeded");

    await expect(runBudgetedAgent(input, injected)).rejects.toBeInstanceOf(
      WorkspaceBudgetExceededError,
    );
    expect(injected.createRunner).not.toHaveBeenCalled();
    expect(repositories.appendAiUsage).not.toHaveBeenCalled();
    expect(repositories.settleAiBudgetReservation).not.toHaveBeenCalled();
  });

  it("rejects an entitlement denial before the runner is created", async () => {
    const { injected, repositories } = dependencies("entitlement_required");

    await expect(runBudgetedAgent(input, injected)).rejects.toThrow(
      "AI provider attempt is not authorized.",
    );
    expect(injected.createRunner).not.toHaveBeenCalled();
    expect(repositories.appendAiUsage).not.toHaveBeenCalled();
  });

  it("releases the hold at zero and marks the task failed when the run fails", async () => {
    const { injected, repositories, runner } = dependencies();
    runner.run.mockRejectedValue(new Error("adapter exploded"));

    await expect(runBudgetedAgent(input, injected)).rejects.toThrow("adapter exploded");

    expect(repositories.settleAiBudgetReservation).toHaveBeenCalledWith(
      expect.objectContaining({ actualCostMicrounits: 0n, reservationId: "hold_1" }),
    );
    expect(repositories.markTaskRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "agent_1", workspaceId: "ws_1" }),
    );
    expect(repositories.appendAiUsage).not.toHaveBeenCalled();
  });

  it("settles at the estimate when the adapter reports no token usage", async () => {
    const { injected, repositories, runner } = dependencies();
    runner.run.mockResolvedValue({
      framework: "ai-sdk",
      text: "done",
      toolCalls: [],
    } as AgentRunResult);

    const outcome = await runBudgetedAgent(input, injected);

    expect(outcome.costMicrounits).toBe(estimatedReservationCost());
    expect(repositories.appendAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        costMicrounits: estimatedReservationCost(),
        inputTokens: 0,
        outputTokens: 0,
      }),
    );
    expect(repositories.settleAiBudgetReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCostMicrounits: estimatedReservationCost(),
        reservationId: "hold_1",
      }),
    );
  });

  it("rejects an unknown catalog model before authorizing spend", async () => {
    const { injected, repositories } = dependencies();
    vi.mocked(injected.findModel).mockResolvedValue(null);

    await expect(runBudgetedAgent(input, injected)).rejects.toBeInstanceOf(AgentModelNotFoundError);
    expect(repositories.recordTaskRun).not.toHaveBeenCalled();
    expect(repositories.authorizeAiProviderAttempt).not.toHaveBeenCalled();
    expect(injected.createRunner).not.toHaveBeenCalled();
  });

  it("rejects a mismatched workspace context before recording the run", async () => {
    const { injected, repositories } = dependencies();
    vi.mocked(injected.resolveWorkspaceAiContext).mockResolvedValue({
      ...context,
      workspaceId: "ws_other",
    });

    await expect(runBudgetedAgent(input, injected)).rejects.toThrow(
      "The agent workspace context is invalid.",
    );
    expect(repositories.recordTaskRun).not.toHaveBeenCalled();
    expect(repositories.authorizeAiProviderAttempt).not.toHaveBeenCalled();
  });

  it("passes the caller scopes into ToolContext verbatim and filters tools to them", async () => {
    const { injected, runner } = dependencies();

    await runBudgetedAgent(input, injected);

    const runInput = runner.run.mock.calls[0]![0] as {
      context: ToolContext;
      maxSteps?: number;
      tools: readonly { name: string }[];
    };
    expect(runInput.context.workspaceId).toBe("ws_1");
    expect(runInput.context.userId).toBe("user_1");
    expect(runInput.context.scopes).toEqual([...input.scopes]);
    expect(runInput.context.scopes).not.toBe(input.scopes);
    expect(runInput.tools.map((tool) => tool.name)).toEqual(["read_thing"]);
    expect(runInput.maxSteps).toBe(DEFAULT_AGENT_MAX_STEPS);
  });

  it("never settles when authorization returns no reservation to hold", async () => {
    const { injected, repositories } = dependencies();
    repositories.authorizeAiProviderAttempt.mockResolvedValue({
      reservationId: null,
      status: "authorized",
    });

    await expect(runBudgetedAgent(input, injected)).resolves.toMatchObject({
      taskId: "agent_1",
    });
    expect(repositories.settleAiBudgetReservation).not.toHaveBeenCalled();
    expect(repositories.persistTaskResult).toHaveBeenCalled();
  });

  it("rejects a BYOK workspace before recording the run", async () => {
    const { injected, repositories } = dependencies();
    vi.mocked(injected.resolveWorkspaceAiContext).mockResolvedValue({
      ...context,
      keyMode: "byok",
    });

    await expect(runBudgetedAgent(input, injected)).rejects.toBeInstanceOf(
      AgentByokUnsupportedError,
    );
    expect(repositories.recordTaskRun).not.toHaveBeenCalled();
    expect(repositories.authorizeAiProviderAttempt).not.toHaveBeenCalled();
    expect(injected.createRunner).not.toHaveBeenCalled();
  });

  it("rejects tool-scoped runs when the catalog model cannot use tools", async () => {
    const { injected, repositories } = dependencies();
    vi.mocked(injected.findModel).mockResolvedValue({
      ...model,
      capabilities: { ...model.capabilities, tools: false },
    });

    await expect(runBudgetedAgent(input, injected)).rejects.toBeInstanceOf(
      AgentModelCapabilityError,
    );
    expect(repositories.recordTaskRun).not.toHaveBeenCalled();
    expect(repositories.authorizeAiProviderAttempt).not.toHaveBeenCalled();
  });

  it("releases the hold at zero and marks the task failed when runner creation fails", async () => {
    const { injected, repositories } = dependencies();
    vi.mocked(injected.createRunner).mockRejectedValue(new Error("framework missing"));

    await expect(runBudgetedAgent(input, injected)).rejects.toThrow("framework missing");
    expect(repositories.settleAiBudgetReservation).toHaveBeenCalledWith(
      expect.objectContaining({ actualCostMicrounits: 0n, reservationId: "hold_1" }),
    );
    expect(repositories.markTaskRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "agent_1", workspaceId: "ws_1" }),
    );
  });

  it("keeps the hold reserved when usage persistence fails after a completed run", async () => {
    const { injected, repositories } = dependencies();
    repositories.appendAiUsage.mockRejectedValue(new Error("ledger down"));

    await expect(runBudgetedAgent(input, injected)).rejects.toThrow("ledger down");
    expect(repositories.settleAiBudgetReservation).not.toHaveBeenCalled();
    expect(repositories.markTaskRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "agent_1", workspaceId: "ws_1" }),
    );
  });

  it("does not settle twice when result persistence fails after the run settled", async () => {
    const { injected, repositories } = dependencies();
    repositories.persistTaskResult.mockResolvedValue(null);

    await expect(runBudgetedAgent(input, injected)).rejects.toThrow(
      "The agent run result could not be persisted.",
    );
    expect(repositories.settleAiBudgetReservation).toHaveBeenCalledTimes(1);
    expect(repositories.markTaskRunFailed).toHaveBeenCalled();
  });

  it("rejects a non-positive maxSteps before touching the workspace", async () => {
    const { injected, repositories } = dependencies();

    await expect(runBudgetedAgent({ ...input, maxSteps: 0 }, injected)).rejects.toThrow(
      /maxSteps/i,
    );
    expect(injected.resolveWorkspaceAiContext).not.toHaveBeenCalled();
    expect(repositories.recordTaskRun).not.toHaveBeenCalled();
  });

  it("scales the reservation estimate by the requested maxSteps", async () => {
    const { injected, repositories, runner } = dependencies();

    await runBudgetedAgent({ ...input, maxSteps: 3 }, injected);

    expect(repositories.authorizeAiProviderAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedUsageMicrounits: estimatedReservationCost(3) }),
    );
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({ maxSteps: 3 }));
  });

  it("forwards the request signal to the agent run", async () => {
    const { injected, runner } = dependencies();
    const controller = new AbortController();

    await runBudgetedAgent({ ...input, signal: controller.signal }, injected);

    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
  });
});
