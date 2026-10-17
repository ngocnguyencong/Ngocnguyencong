import { describe, expect, it, vi } from "vitest";

import type { ToolContext } from "@supastack/agents";

import {
  createWorkspaceTools,
  WorkspaceToolError,
  type WorkspaceToolsBff,
} from "./workspace-tools";

const context: ToolContext = Object.freeze({
  scopes: ["read", "write"] as const,
  userId: "user_1",
  workspaceId: "ws_1",
});

function fakeBff(overrides: Partial<WorkspaceToolsBff> = {}): WorkspaceToolsBff {
  return {
    createAiTask: vi.fn(async () => ({ body: { taskId: "task_1" }, status: 201 })),
    currentWorkspace: vi.fn(async () => ({
      body: { name: "Acme", workspaceId: "ws_1" },
      status: 200,
    })),
    entitlements: vi.fn(async () => ({ body: { data: [] }, status: 200 })),
    readAiTask: vi.fn(async () => ({ body: { status: "queued" }, status: 200 })),
    readAiTaskResult: vi.fn(async () => ({ body: { output: {} }, status: 200 })),
    ...overrides,
  };
}

describe("createWorkspaceTools", () => {
  it("defines the five shared tools with REST scopes", () => {
    const tools = createWorkspaceTools({ bff: fakeBff(), headers: new Headers() });
    expect(tools.map((tool) => [tool.name, tool.scope])).toEqual([
      ["get_workspace", "read"],
      ["list_entitlements", "read"],
      ["create_ai_task", "write"],
      ["get_ai_task", "read"],
      ["get_ai_task_result", "read"],
    ]);
  });

  it("passes caller headers through to the BFF", async () => {
    const headers = new Headers({ authorization: "Bearer sk_test_x" });
    const bff = fakeBff();
    const tools = createWorkspaceTools({ bff, headers });
    const getWorkspace = tools.find((tool) => tool.name === "get_workspace")!;

    await getWorkspace.execute({}, context);

    expect(bff.currentWorkspace).toHaveBeenCalledWith(headers);
  });

  it("creates AI tasks with the context workspace, never model input", async () => {
    const headers = new Headers({ authorization: "Bearer sk_test_x" });
    const bff = fakeBff();
    const tools = createWorkspaceTools({ bff, headers });
    const createTask = tools.find((tool) => tool.name === "create_ai_task")!;

    await createTask.execute(
      { alias: "fast", prompt: "Summarize this", requirements: { vision: true } },
      context,
    );

    expect(bff.createAiTask).toHaveBeenCalledWith(headers, {
      alias: "fast",
      input: { prompt: "Summarize this" },
      requirements: { vision: true },
      workspaceId: "ws_1",
    });
  });

  it("defaults requirements to an empty object for the BFF contract", async () => {
    const bff = fakeBff();
    const tools = createWorkspaceTools({ bff, headers: new Headers() });
    const createTask = tools.find((tool) => tool.name === "create_ai_task")!;

    await createTask.execute({ alias: "smart", prompt: "Hi" }, context);

    expect(bff.createAiTask).toHaveBeenCalledWith(expect.any(Headers), {
      alias: "smart",
      input: { prompt: "Hi" },
      requirements: {},
      workspaceId: "ws_1",
    });
  });

  it("reads tasks and results by id through the BFF", async () => {
    const headers = new Headers();
    const bff = fakeBff();
    const tools = createWorkspaceTools({ bff, headers });

    await tools.find((tool) => tool.name === "get_ai_task")!.execute({ taskId: "t_1" }, context);
    await tools
      .find((tool) => tool.name === "get_ai_task_result")!
      .execute({ taskId: "t_2" }, context);

    expect(bff.readAiTask).toHaveBeenCalledWith(headers, "t_1");
    expect(bff.readAiTaskResult).toHaveBeenCalledWith(headers, "t_2");
  });

  it("maps non-2xx BFF responses to WorkspaceToolError", async () => {
    const bff = fakeBff({
      readAiTask: vi.fn(async () => ({
        body: { error: { code: "notFound", message: "The task was not found." } },
        status: 404,
      })),
    });
    const tools = createWorkspaceTools({ bff, headers: new Headers() });
    const getTask = tools.find((tool) => tool.name === "get_ai_task")!;

    const error = await getTask.execute({ taskId: "t_9" }, context).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WorkspaceToolError);
    expect((error as WorkspaceToolError).code).toBe("notFound");
    expect((error as WorkspaceToolError).message).toBe("The task was not found.");
  });

  it("surfaces a BFF 429 as a rateLimited WorkspaceToolError", async () => {
    const bff = fakeBff({
      createAiTask: vi.fn(async () => ({
        body: {
          error: { code: "rateLimited", message: "Too many AI tasks. Try again shortly." },
        },
        status: 429,
      })),
    });
    const tools = createWorkspaceTools({ bff, headers: new Headers() });
    const createTask = tools.find((tool) => tool.name === "create_ai_task")!;

    const error = await createTask
      .execute({ alias: "fast", prompt: "Hi" }, context)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WorkspaceToolError);
    expect((error as WorkspaceToolError).code).toBe("rateLimited");
    expect((error as WorkspaceToolError).message).toBe("Too many AI tasks. Try again shortly.");
  });
});
