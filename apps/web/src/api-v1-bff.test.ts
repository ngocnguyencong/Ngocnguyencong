import { openApiDocument } from "@supastack/api";
import { describe, expect, it, vi } from "vitest";

import { ApiV1DependencyError, createApiV1Bff, type ApiV1BffDependencies } from "./api-v1-bff.js";

const requestId = "11111111-1111-4111-8111-111111111111";

function createDependencies(overrides: Partial<ApiV1BffDependencies> = {}): ApiV1BffDependencies {
  return {
    createRequestId: () => requestId,
    getSession: async () => ({ user: { id: "user-a" } }),
    findCurrentWorkspace: async () => ({
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      name: "Avery's workspace",
      workspaceId: "workspace-a",
    }),
    listEntitlements: async () => [
      {
        entitlementId: "ent_1",
        expiresAt: null,
        productKey: "ai.reference-task",
        status: "active",
        workspaceId: "workspace-a",
      },
    ],
    createAiTask: vi.fn(async () => ({
      createdAt: "2026-09-10T12:00:00.000Z",
      status: "queued" as const,
      taskId: "task_1",
      workspaceId: "workspace-a",
    })),
    readAiTask: vi.fn(async () => ({
      createdAt: "2026-09-10T12:00:00.000Z",
      status: "completed" as const,
      taskId: "task_1",
      workspaceId: "workspace-a",
    })),
    readAiTaskResult: vi.fn(async () => ({
      completedAt: "2026-09-10T12:01:00.000Z",
      output: { text: "done" },
      taskId: "task_1",
      workspaceId: "workspace-a",
    })),
    ...overrides,
  };
}

describe("API V1 BFF", () => {
  it("returns the published OpenAPI document", async () => {
    const response = await createApiV1Bff(createDependencies()).openapi();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      openapi: openApiDocument.openapi,
      info: openApiDocument.info,
    });
    expect(response.body.paths).toHaveProperty("/api/v1/workspaces/current");
  });

  it("requires authentication for the current workspace", async () => {
    const bff = createApiV1Bff(
      createDependencies({
        getSession: async () => null,
      }),
    );
    await expect(bff.currentWorkspace(new Headers())).resolves.toEqual({
      body: {
        error: {
          code: "unauthorized",
          message: "Authentication is required.",
          requestId,
        },
      },
      status: 401,
    });
  });

  it("returns the current personal workspace", async () => {
    const bff = createApiV1Bff(createDependencies());
    await expect(bff.currentWorkspace(new Headers())).resolves.toEqual({
      body: {
        createdAt: "2026-09-01T00:00:00.000Z",
        name: "Avery's workspace",
        workspaceId: "workspace-a",
      },
      status: 200,
    });
  });

  it("lists entitlements for the current workspace", async () => {
    const bff = createApiV1Bff(createDependencies());
    await expect(bff.entitlements(new Headers())).resolves.toEqual({
      body: {
        data: [
          {
            entitlementId: "ent_1",
            expiresAt: null,
            productKey: "ai.reference-task",
            status: "active",
            workspaceId: "workspace-a",
          },
        ],
      },
      status: 200,
    });
  });

  it("returns the supported model requirements contract", async () => {
    const bff = createApiV1Bff(createDependencies());
    await expect(bff.modelRequirements(new Headers())).resolves.toEqual({
      body: {
        data: {
          structuredOutput: true,
          tools: true,
          vision: true,
        },
      },
      status: 200,
    });
  });

  it("creates an AI task from the public V1 body and rejects workspace mismatch", async () => {
    const createAiTask = vi.fn(async () => ({
      createdAt: "2026-09-10T12:00:00.000Z",
      status: "queued" as const,
      taskId: "task_1",
      workspaceId: "workspace-a",
    }));
    const bff = createApiV1Bff(createDependencies({ createAiTask }));

    await expect(
      bff.createAiTask(new Headers(), {
        alias: "fast",
        input: { prompt: "Summarize acceptance criteria." },
        requirements: { tools: true },
        workspaceId: "workspace-b",
      }),
    ).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "forbidden" } },
    });

    await expect(
      bff.createAiTask(new Headers(), {
        alias: "fast",
        input: { prompt: "Summarize acceptance criteria." },
        requirements: { tools: true },
        workspaceId: "workspace-a",
      }),
    ).resolves.toEqual({
      body: {
        createdAt: "2026-09-10T12:00:00.000Z",
        status: "queued",
        taskId: "task_1",
        workspaceId: "workspace-a",
      },
      status: 201,
    });
    expect(createAiTask).toHaveBeenCalledWith({
      alias: "fast",
      caller: { userId: "user-a", workspaceId: "workspace-a" },
      headers: expect.any(Headers),
      prompt: "Summarize acceptance criteria.",
      requirements: { tools: true },
      workspaceId: "workspace-a",
    });
  });

  it("passes the session-resolved caller to task read dependencies", async () => {
    const readAiTask = vi.fn(async () => ({
      createdAt: "2026-09-10T12:00:00.000Z",
      status: "completed" as const,
      taskId: "task_1",
      workspaceId: "workspace-a",
    }));
    const readAiTaskResult = vi.fn(async () => ({
      completedAt: "2026-09-10T12:01:00.000Z",
      output: { text: "done" },
      taskId: "task_1",
      workspaceId: "workspace-a",
    }));
    const bff = createApiV1Bff(createDependencies({ readAiTask, readAiTaskResult }));

    await expect(bff.readAiTask(new Headers(), "task_1")).resolves.toMatchObject({ status: 200 });
    expect(readAiTask).toHaveBeenCalledWith({
      caller: { userId: "user-a", workspaceId: "workspace-a" },
      headers: expect.any(Headers),
      taskId: "task_1",
    });
    await expect(bff.readAiTaskResult(new Headers(), "task_1")).resolves.toMatchObject({
      status: 200,
    });
    expect(readAiTaskResult).toHaveBeenCalledWith({
      caller: { userId: "user-a", workspaceId: "workspace-a" },
      headers: expect.any(Headers),
      taskId: "task_1",
    });
  });

  it("reads AI task status and completed result", async () => {
    const bff = createApiV1Bff(createDependencies());
    await expect(bff.readAiTask(new Headers(), "task_1")).resolves.toEqual({
      body: {
        createdAt: "2026-09-10T12:00:00.000Z",
        status: "completed",
        taskId: "task_1",
        workspaceId: "workspace-a",
      },
      status: 200,
    });
    await expect(bff.readAiTaskResult(new Headers(), "task_1")).resolves.toEqual({
      body: {
        completedAt: "2026-09-10T12:01:00.000Z",
        output: { text: "done" },
        taskId: "task_1",
        workspaceId: "workspace-a",
      },
      status: 200,
    });
  });

  it("re-envelopes a dependency 429 as rateLimited instead of a 500", async () => {
    const bff = createApiV1Bff(
      createDependencies({
        createAiTask: vi.fn(async () => {
          throw new ApiV1DependencyError(
            429,
            "rateLimited",
            "Too many AI tasks. Try again shortly.",
          );
        }),
      }),
    );

    await expect(
      bff.createAiTask(new Headers(), {
        alias: "fast",
        input: { prompt: "Summarize." },
        requirements: {},
        workspaceId: "workspace-a",
      }),
    ).resolves.toEqual({
      body: {
        error: {
          code: "rateLimited",
          message: "Too many AI tasks. Try again shortly.",
          requestId,
        },
      },
      status: 429,
    });
  });
});

describe("API V1 BFF API-key auth", () => {
  const bearerHeaders = new Headers({ authorization: "Bearer sk_test_abc" });
  const apiKeyCaller = {
    scopes: ["read", "write"],
    userId: "user-key-owner",
    workspace: {
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      name: "Key workspace",
      workspaceId: "workspace-key",
    },
  };

  it("authenticates requests with a workspace-bound API key", async () => {
    const bff = createApiV1Bff(
      createDependencies({
        getSession: async () => null,
        resolveApiKey: async () => apiKeyCaller,
      }),
    );
    await expect(bff.currentWorkspace(bearerHeaders)).resolves.toEqual({
      body: {
        createdAt: "2026-09-01T00:00:00.000Z",
        name: "Key workspace",
        workspaceId: "workspace-key",
      },
      status: 200,
    });
  });

  it("rejects invalid bearer keys instead of falling back to sessions", async () => {
    const getSession = vi.fn(async () => ({ user: { id: "user-a" } }));
    const bff = createApiV1Bff(
      createDependencies({
        getSession,
        resolveApiKey: async () => "invalid" as const,
      }),
    );
    await expect(bff.currentWorkspace(bearerHeaders)).resolves.toMatchObject({
      status: 401,
      body: { error: { code: "unauthorized" } },
    });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("enforces the write scope for task creation", async () => {
    const bff = createApiV1Bff(
      createDependencies({
        getSession: async () => null,
        resolveApiKey: async () => ({ ...apiKeyCaller, scopes: ["read"] }),
      }),
    );
    await expect(
      bff.createAiTask(bearerHeaders, {
        alias: "fast",
        input: { prompt: "Summarize." },
        requirements: {},
        workspaceId: "workspace-key",
      }),
    ).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "forbidden" } },
    });
  });

  it("binds the key to its own workspace for task creation", async () => {
    const createAiTask = vi.fn(async () => ({
      createdAt: "2026-09-10T12:00:00.000Z",
      status: "queued" as const,
      taskId: "task_1",
      workspaceId: "workspace-key",
    }));
    const bff = createApiV1Bff(
      createDependencies({
        createAiTask,
        getSession: async () => null,
        resolveApiKey: async () => apiKeyCaller,
      }),
    );
    await expect(
      bff.createAiTask(bearerHeaders, {
        alias: "fast",
        input: { prompt: "Summarize." },
        requirements: {},
        workspaceId: "workspace-a",
      }),
    ).resolves.toMatchObject({ status: 403 });
    await expect(
      bff.createAiTask(bearerHeaders, {
        alias: "fast",
        input: { prompt: "Summarize." },
        requirements: {},
        workspaceId: "workspace-key",
      }),
    ).resolves.toMatchObject({ status: 201 });
    expect(createAiTask).toHaveBeenCalledWith(
      expect.objectContaining({
        caller: { userId: "user-key-owner", workspaceId: "workspace-key" },
      }),
    );
  });

  it("propagates the API-key caller to task read dependencies", async () => {
    const readAiTask = vi.fn(async () => ({
      createdAt: "2026-09-10T12:00:00.000Z",
      status: "queued" as const,
      taskId: "task_1",
      workspaceId: "workspace-key",
    }));
    const readAiTaskResult = vi.fn(async () => ({
      completedAt: "2026-09-10T12:01:00.000Z",
      output: { text: "done" },
      taskId: "task_1",
      workspaceId: "workspace-key",
    }));
    const bff = createApiV1Bff(
      createDependencies({
        getSession: async () => null,
        readAiTask,
        readAiTaskResult,
        resolveApiKey: async () => apiKeyCaller,
      }),
    );

    await expect(bff.readAiTask(bearerHeaders, "task_1")).resolves.toMatchObject({ status: 200 });
    expect(readAiTask).toHaveBeenCalledWith({
      caller: { userId: "user-key-owner", workspaceId: "workspace-key" },
      headers: bearerHeaders,
      taskId: "task_1",
    });
    await expect(bff.readAiTaskResult(bearerHeaders, "task_1")).resolves.toMatchObject({
      status: 200,
    });
    expect(readAiTaskResult).toHaveBeenCalledWith({
      caller: { userId: "user-key-owner", workspaceId: "workspace-key" },
      headers: bearerHeaders,
      taskId: "task_1",
    });
  });

  it("denies reading tasks outside the key workspace", async () => {
    const bff = createApiV1Bff(
      createDependencies({
        getSession: async () => null,
        resolveApiKey: async () => apiKeyCaller,
      }),
    );
    await expect(bff.readAiTask(bearerHeaders, "task_1")).resolves.toMatchObject({
      status: 404,
    });
  });
});
