import type * as drizzleOrm from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Minimal drizzle chain duck — same shape as webhook-delivery.test.ts:
 * select().from().where() (or innerJoin().where()) pops one queued row-set;
 * where() results are thenable AND expose .limit() for the policy query.
 */
const db = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const where = () => {
    const rows = selectResults.shift() ?? [];
    return Object.assign(Promise.resolve(rows), {
      limit: vi.fn(() => Promise.resolve(rows)),
    });
  };
  const database = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({ where: vi.fn(where) })),
        where: vi.fn(where),
      })),
    })),
  };
  return { database, selectResults };
});
vi.mock("./auth-runtime", () => ({ database: db.database, getAuthSession: vi.fn() }));

vi.mock("@supastack/config", () => ({
  parseServerConfig: () => ({
    aiRouting: undefined,
    app: { webUrl: "http://localhost:3000" },
    providers: { email: { kind: "local" }, jobs: { kind: "local" } },
  }),
}));
vi.mock("@supastack/jobs", () => ({ TriggerWorkflowClient: class {} }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: {} }));
vi.mock("./ai-model-catalog", () => ({
  createRuntimeModelRouter: () => ({ complete: vi.fn() }),
  toAvailableModels: () => [],
}));
vi.mock("./ai-task-bff", () => ({ createAiTaskBff: vi.fn(() => ({})) }));
vi.mock("./ai-task-submission-store", () => ({
  createAiTaskSubmissionStore: vi.fn(() => ({})),
  readAiTaskSubmission: vi.fn(),
}));
const executorRun = vi.hoisted(() => vi.fn());
const executorDeps = vi.hoisted(() => ({
  current: null as {
    onTaskCompleted?: (
      input: Readonly<{ correlationId?: string; taskId: string; workspaceId: string }>,
    ) => Promise<void>;
  } | null,
}));
vi.mock("./ai-task-executor", () => ({
  AiTaskExecutionError: class AiTaskExecutionError extends Error {},
  createProductionAiTaskExecutor: (deps: typeof executorDeps.current) => {
    executorDeps.current = deps;
    return { run: executorRun };
  },
  parseTriggeredAiTaskPayload: vi.fn(),
  PRODUCTION_AI_MAX_OUTPUT_TOKENS: 8_192,
}));
const emitWorkspaceEvent = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("./webhook-delivery", () => ({ tryEmitWorkspaceEvent: emitWorkspaceEvent }));
vi.mock("./byok-key-vault", () => ({ createServerDrizzleProviderKeyResolver: vi.fn() }));
vi.mock("./chat-budget", () => ({ completeBudgetedChat: vi.fn(async () => ({})) }));
vi.mock("./agent-budget", () => ({ runBudgetedAgent: vi.fn(async () => ({})) }));
// The production wiring imports agent-runtime lazily; the mock must intercept
// the dynamic import the same way a static one would be.
vi.mock("./agent-runtime", () => ({
  createWorkspaceAgentRunner: vi.fn(async () => ({})),
}));
const observability = vi.hoisted(() => ({
  captureException: vi.fn(),
  // The mock runs the wrapped fn straight through — duration emission is
  // observability-runtime's own concern, pinned by its tests.
  measure: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  track: vi.fn(),
}));
vi.mock("./observability-runtime", () => ({ serverObservability: observability }));
vi.mock("./rate-limit-runtime", () => ({
  aiTaskUserLimiter: { check: vi.fn() },
  aiTaskWorkspaceLimiter: { check: vi.fn() },
}));
vi.mock("./server-provider-composition", () => ({
  createServerProviderComposition: () => ({ ai: { provider: "fake" }, email: {} }),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof drizzleOrm>();
  return {
    ...actual,
    eq: vi.fn(actual.eq),
    gte: vi.fn(actual.gte),
    lt: vi.fn(actual.lt),
  };
});

import { aiBudgetReservation, aiModel, aiUsage } from "@supastack/db";
import { eq, gte, lt } from "drizzle-orm";

import { runBudgetedAgent } from "./agent-budget";
import { createWorkspaceAgentRunner } from "./agent-runtime";
import { AiTaskExecutionError, parseTriggeredAiTaskPayload } from "./ai-task-executor";
import {
  executeTriggeredAiTask,
  findWorkspaceContext,
  getAgentRunRuntime,
  getChatStreamRuntime,
} from "./ai-task-runtime";
import { completeBudgetedChat } from "./chat-budget";

/**
 * `resolveWorkspaceAiContext` is module-private; the chat stream runtime
 * injects it into `completeBudgetedChat`, so the mock captures it there.
 */
async function resolveContext() {
  const { completeChat } = getChatStreamRuntime();
  await completeChat({ alias: "fast", prompt: "hi", requirements: {}, workspaceId: "ws_1" });
  return vi.mocked(completeBudgetedChat).mock.calls[0]![1].resolveWorkspaceAiContext;
}

afterEach(() => {
  vi.useRealTimers();
  db.selectResults.length = 0;
  executorRun.mockReset();
  observability.captureException.mockReset();
  observability.measure.mockClear();
  observability.track.mockReset();
  emitWorkspaceEvent.mockClear();
  vi.mocked(parseTriggeredAiTaskPayload).mockReset();
  vi.mocked(completeBudgetedChat).mockClear();
  vi.mocked(runBudgetedAgent).mockClear();
  vi.mocked(createWorkspaceAgentRunner).mockClear();
  vi.mocked(eq).mockClear();
  vi.mocked(gte).mockClear();
  vi.mocked(lt).mockClear();
});

describe("resolveWorkspaceAiContext", () => {
  it("sums usage in [monthStart, nextMonthStart) — the same window the authorization path uses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
    const resolveWorkspaceAiContext = await resolveContext();

    db.selectResults.push([{ keyMode: "platform", monthlyBudgetMicrounits: 5_000_000n }]);
    db.selectResults.push([{ costMicrounits: 100n }, { costMicrounits: 50n }]);
    db.selectResults.push([{ reservedMicrounits: 25n }]);

    await expect(resolveWorkspaceAiContext("ws_1")).resolves.toEqual({
      budget: { limitMicrounits: 5_000_000n, spentMicrounits: 175n },
      keyMode: "platform",
      workspaceId: "ws_1",
    });

    // A future-dated ai_usage row must not inflate the routing snapshot.
    const monthStart = new Date(Date.UTC(2026, 2, 1));
    expect(gte).toHaveBeenCalledWith(aiUsage.createdAt, monthStart);
    expect(lt).toHaveBeenCalledWith(aiUsage.createdAt, new Date(Date.UTC(2026, 3, 1)));
    // Active holds stay windowed by exact periodStart match, as in the DB.
    expect(eq).toHaveBeenCalledWith(aiBudgetReservation.periodStart, monthStart);
  });
});

describe("findWorkspaceContext", () => {
  it("rejects guest membership before checking AI entitlement", async () => {
    db.selectResults.push([{ email: "guest@example.test", role: "guest", workspaceId: "ws_1" }]);
    await expect(findWorkspaceContext("user-a", "ws_1", "write")).resolves.toBeNull();
    expect(db.selectResults).toHaveLength(0);
  });

  it("keeps an entitled member's workspace-scoped task context", async () => {
    db.selectResults.push([{ email: "member@example.test", role: "member", workspaceId: "ws_1" }]);
    db.selectResults.push([{ workspaceId: "ws_1" }]);
    await expect(findWorkspaceContext("user-a", "ws_1")).resolves.toEqual({
      completionEmailTo: "member@example.test",
      hasAiEntitlement: true,
      workspaceId: "ws_1",
    });
  });
});

describe("executeTriggeredAiTask", () => {
  const triggeredPayload = {
    alias: "smart" as const,
    completionEmailTo: "owner@example.test",
    correlationId: "corr_00000000-0000-4000-8000-000000000000",
    prompt: "hi",
    requirements: {},
    taskId: "task_1",
    workspaceId: "ws_1",
  };

  it("threads the payload correlationId into the completion event and the duration measure", async () => {
    vi.mocked(parseTriggeredAiTaskPayload).mockReturnValue(triggeredPayload);
    executorRun.mockResolvedValue({ status: "completed" });

    await expect(executeTriggeredAiTask({ envelope: true })).resolves.toEqual({
      status: "completed",
    });
    expect(executorRun).toHaveBeenCalledWith(triggeredPayload);
    expect(observability.track).toHaveBeenCalledWith({
      distinctId: "ws_1",
      name: "ai_task_completed",
      properties: { correlationId: triggeredPayload.correlationId, taskId: "task_1" },
      workspaceId: "ws_1",
    });
    expect(observability.measure).toHaveBeenCalledWith(
      "ai.task.execute",
      expect.any(Function),
      expect.objectContaining({
        correlationId: triggeredPayload.correlationId,
        taskId: "task_1",
        workspaceId: "ws_1",
      }),
    );
  });

  it("mints a fresh corr_ id at execution start when the payload predates correlation", async () => {
    const { correlationId: _omitted, ...legacyPayload } = triggeredPayload;
    void _omitted;
    vi.mocked(parseTriggeredAiTaskPayload).mockReturnValue(legacyPayload);
    executorRun.mockResolvedValue({ status: "completed" });

    await executeTriggeredAiTask({ envelope: true });
    const event = observability.track.mock.calls[0]![0];
    expect(event.properties).toMatchObject({
      correlationId: expect.stringMatching(/^corr_[0-9a-f-]{36}$/),
      taskId: "task_1",
    });
  });

  it("carries the correlationId into captureException on executor failure", async () => {
    vi.mocked(parseTriggeredAiTaskPayload).mockReturnValue(triggeredPayload);
    executorRun.mockRejectedValue(new Error("smtp-password-secret"));

    const failure = await executeTriggeredAiTask({ envelope: true }).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(AiTaskExecutionError);
    expect(observability.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        correlationId: triggeredPayload.correlationId,
        operation: "ai.task.execute",
        taskId: "task_1",
        workspaceId: "ws_1",
      }),
    );
    expect(observability.track).not.toHaveBeenCalled();
  });
});

describe("getAgentRunRuntime wiring", () => {
  const agentInput = {
    modelId: "catalog-fake-smart",
    prompt: "Summarize",
    scopes: [],
    userId: "user_1",
    workspaceId: "ws_1",
  } as const;

  function capturedDeps() {
    getAgentRunRuntime().runAgent(agentInput, []);
    const deps = vi.mocked(runBudgetedAgent).mock.calls[0]?.[1];
    expect(deps).toBeDefined();
    return deps!;
  }

  it("resolves the requested catalog model by ai_model.id, never a positional fallback", async () => {
    const deps = capturedDeps();
    db.selectResults.push([]);

    await expect(deps.findModel("catalog-fake-smart")).resolves.toBeNull();
    expect(eq).toHaveBeenCalledWith(aiModel.id, "catalog-fake-smart");
  });

  it("forwards the provider model name to createWorkspaceAgentRunner via the lazy import", async () => {
    const deps = capturedDeps();

    await deps.createRunner("fake-smart");
    expect(createWorkspaceAgentRunner).toHaveBeenCalledWith(
      expect.objectContaining({ app: { webUrl: "http://localhost:3000" } }),
      "fake-smart",
    );
  });

  it("passes the caller's shared tools through to the helper", () => {
    const tools = [] as const;
    getAgentRunRuntime().runAgent(agentInput, tools);

    expect(vi.mocked(runBudgetedAgent).mock.calls[0]?.[1].tools).toBe(tools);
  });
});

describe("executor completion wiring", () => {
  it("threads the task correlationId into the ai.task_completed workspace event", async () => {
    // `createProductionAiTaskExecutor` captured its deps at module load.
    await executorDeps.current?.onTaskCompleted?.({
      correlationId: "corr_req-9",
      taskId: "task_9",
      workspaceId: "ws_1",
    });

    expect(emitWorkspaceEvent).toHaveBeenCalledWith({
      correlationId: "corr_req-9",
      data: { taskId: "task_9" },
      eventType: "ai.task_completed",
      workspaceId: "ws_1",
    });
  });

  it("emits without correlationId when the completed task predates correlation", async () => {
    await executorDeps.current?.onTaskCompleted?.({ taskId: "task_9", workspaceId: "ws_1" });

    expect(emitWorkspaceEvent).toHaveBeenCalledWith({
      data: { taskId: "task_9" },
      eventType: "ai.task_completed",
      workspaceId: "ws_1",
    });
  });
});
