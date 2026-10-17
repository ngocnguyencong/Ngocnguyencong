import { defineTool, type ToolDefinition } from "@supastack/agents";
import { z } from "zod";

/**
 * Raised when the /api/v1 BFF answers a non-2xx response. The MCP server turns
 * this into an `isError` tool result; message stays a safe REST error string.
 */
export class WorkspaceToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceToolError";
  }
}

type BffResponse = Readonly<{ body: unknown; status: number }>;

/** The subset of `apiV1Bff` the shared workspace tools need. */
export interface WorkspaceToolsBff {
  createAiTask(headers: Headers, body: unknown): Promise<BffResponse>;
  currentWorkspace(headers: Headers): Promise<BffResponse>;
  entitlements(headers: Headers): Promise<BffResponse>;
  readAiTask(headers: Headers, taskId: string): Promise<BffResponse>;
  readAiTaskResult(headers: Headers, taskId: string): Promise<BffResponse>;
}

export interface WorkspaceToolsDependencies {
  bff: WorkspaceToolsBff;
  headers: Headers;
}

function errorBody(body: unknown): { code: string; message: string } {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "object" && error !== null) {
      const { code, message } = error as { code?: unknown; message?: unknown };
      return {
        code: typeof code === "string" ? code : "internalError",
        message: typeof message === "string" ? message : "The workspace tool request failed.",
      };
    }
  }
  return { code: "internalError", message: "The workspace tool request failed." };
}

/**
 * Workspace tools defined once and shared by agent runners and the MCP
 * endpoint. Every call goes through the /api/v1 BFF with the caller's own
 * headers, so REST auth, scope, and workspace checks are identical — the tool
 * layer never widens access.
 */
export function createWorkspaceTools(
  dependencies: WorkspaceToolsDependencies,
): readonly ToolDefinition[] {
  const { bff, headers } = dependencies;

  async function call(response: Promise<BffResponse>): Promise<unknown> {
    const result = await response;
    if (result.status < 200 || result.status >= 300) {
      const error = errorBody(result.body);
      throw new WorkspaceToolError(error.code, error.message);
    }
    return result.body;
  }

  return [
    defineTool({
      description: "Get the caller's current workspace (id, name, createdAt).",
      execute: async () => call(bff.currentWorkspace(headers)),
      inputSchema: z.object({}),
      name: "get_workspace",
      scope: "read",
      title: "Get workspace",
    }),
    defineTool({
      description: "List the current workspace's product entitlements.",
      execute: async () => call(bff.entitlements(headers)),
      inputSchema: z.object({}),
      name: "list_entitlements",
      scope: "read",
      title: "List entitlements",
    }),
    defineTool({
      description:
        "Queue an AI task in the current workspace using a model alias (fast | smart | cheap).",
      execute: async (input, context) =>
        call(
          bff.createAiTask(headers, {
            alias: input.alias,
            input: { prompt: input.prompt },
            requirements: input.requirements ?? {},
            workspaceId: context.workspaceId,
          }),
        ),
      inputSchema: z.object({
        alias: z.enum(["fast", "smart", "cheap"]),
        prompt: z.string().trim().min(1).max(100_000),
        requirements: z
          .object({
            minContext: z.number().int().min(1).optional(),
            structuredOutput: z.boolean().optional(),
            tools: z.boolean().optional(),
            vision: z.boolean().optional(),
          })
          .optional(),
      }),
      name: "create_ai_task",
      scope: "write",
      title: "Create AI task",
    }),
    defineTool({
      description: "Get the status of an AI task by id.",
      execute: async (input) => call(bff.readAiTask(headers, input.taskId)),
      inputSchema: z.object({ taskId: z.string().min(1) }),
      name: "get_ai_task",
      scope: "read",
      title: "Get AI task",
    }),
    defineTool({
      description: "Get the completed result of an AI task by id.",
      execute: async (input) => call(bff.readAiTaskResult(headers, input.taskId)),
      inputSchema: z.object({ taskId: z.string().min(1) }),
      name: "get_ai_task_result",
      scope: "read",
      title: "Get AI task result",
    }),
  ];
}
