import type { SupastackOpenApiDocument } from "@supastack/api";
import { openApiDocument } from "@supastack/api";
import { randomUUID } from "node:crypto";

export type ApiV1ErrorCode =
  | "validationError"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "rateLimited"
  | "internalError";

export type ApiV1Session = Readonly<{ user: Readonly<{ id: string }> }>;

export type ApiV1Workspace = Readonly<{
  createdAt: Date;
  name: string;
  workspaceId: string;
}>;

export type ApiV1EntitlementStatus = "active" | "trialing" | "past_due" | "inactive";

export type ApiV1Entitlement = Readonly<{
  entitlementId: string;
  expiresAt: string | null;
  productKey: string;
  status: ApiV1EntitlementStatus;
  workspaceId: string;
}>;

export type ApiV1TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type ApiV1Task = Readonly<{
  createdAt: string;
  error?: string;
  status: ApiV1TaskStatus;
  taskId: string;
  workspaceId: string;
}>;

export type ApiV1TaskResult = Readonly<{
  completedAt: string;
  output: Record<string, unknown>;
  taskId: string;
  workspaceId: string;
}>;

/** Authenticated caller resolved by the BFF and forwarded to task dependencies. */
export type ApiV1TaskCaller = Readonly<{ userId: string; workspaceId: string }>;

export type ApiV1CreateAiTaskInput = Readonly<{
  alias: "fast" | "smart" | "cheap";
  caller: ApiV1TaskCaller;
  headers: Headers;
  prompt: string;
  requirements: Readonly<{
    minContext?: number;
    structuredOutput?: boolean;
    tools?: boolean;
    vision?: boolean;
  }>;
  workspaceId: string;
}>;

/** Caller resolved from an `Authorization: Bearer sk_*` API key. */
export type ApiV1ApiKeyCaller = Readonly<{
  scopes: readonly string[];
  userId: string;
  workspace: ApiV1Workspace;
}>;

export interface ApiV1BffDependencies {
  createAiTask(input: ApiV1CreateAiTaskInput): Promise<ApiV1Task>;
  createRequestId(): string;
  findCurrentWorkspace(userId: string): Promise<ApiV1Workspace | null>;
  getSession(headers: Headers): Promise<ApiV1Session | null>;
  listEntitlements(workspaceId: string): Promise<readonly ApiV1Entitlement[]>;
  readAiTask(
    input: Readonly<{ caller: ApiV1TaskCaller; headers: Headers; taskId: string }>,
  ): Promise<ApiV1Task | null>;
  readAiTaskResult(
    input: Readonly<{ caller: ApiV1TaskCaller; headers: Headers; taskId: string }>,
  ): Promise<ApiV1TaskResult | null | "notReady">;
  /**
   * Optional API-key auth. Return the caller for a valid key, `"invalid"` when
   * a bearer token was supplied but cannot be used, and `null` when no bearer
   * token is present so cookie-session auth still applies.
   */
  resolveApiKey?(headers: Headers): Promise<ApiV1ApiKeyCaller | "invalid" | null>;
}

type ResolvedCaller = Readonly<{
  scopes: readonly string[] | null;
  userId: string;
  workspace: ApiV1Workspace;
}>;

type CallerResolution =
  | Readonly<{ caller: ResolvedCaller; kind: "caller" }>
  | Readonly<{ kind: "noWorkspace" }>
  | Readonly<{ kind: "unauthorized" }>;

type ErrorBody = Readonly<{
  error: Readonly<{ code: ApiV1ErrorCode; message: string; requestId: string }>;
}>;

function errorResponse(
  dependencies: ApiV1BffDependencies,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500,
  code: ApiV1ErrorCode,
  message: string,
): Readonly<{ body: ErrorBody; status: typeof status }> {
  return {
    body: {
      error: {
        code,
        message,
        requestId: dependencies.createRequestId(),
      },
    },
    status,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCreateBody(value: unknown): {
  alias: "fast" | "smart" | "cheap";
  input: Record<string, unknown>;
  prompt: string;
  requirements: ApiV1CreateAiTaskInput["requirements"];
  workspaceId: string;
} | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.alias !== "fast" && value.alias !== "smart" && value.alias !== "cheap") {
    return null;
  }
  if (typeof value.workspaceId !== "string" || value.workspaceId.trim().length === 0) {
    return null;
  }
  if (!isRecord(value.input) || typeof value.input.prompt !== "string") {
    return null;
  }
  const prompt = value.input.prompt.trim();
  if (prompt.length === 0 || prompt.length > 100_000) {
    return null;
  }
  if (!isRecord(value.requirements)) {
    return null;
  }
  const allowed = new Set(["minContext", "structuredOutput", "tools", "vision"]);
  if (Object.keys(value.requirements).some((key) => !allowed.has(key))) {
    return null;
  }
  for (const key of ["structuredOutput", "tools", "vision"] as const) {
    if (value.requirements[key] !== undefined && typeof value.requirements[key] !== "boolean") {
      return null;
    }
  }
  if (
    value.requirements.minContext !== undefined &&
    (!Number.isSafeInteger(value.requirements.minContext) ||
      (value.requirements.minContext as number) < 1)
  ) {
    return null;
  }

  return {
    alias: value.alias,
    input: value.input,
    prompt,
    requirements: Object.freeze({ ...value.requirements }),
    workspaceId: value.workspaceId,
  };
}

export function createApiV1Bff(dependencies: ApiV1BffDependencies) {
  async function resolveCaller(headers: Headers): Promise<CallerResolution> {
    if (dependencies.resolveApiKey !== undefined) {
      const apiKey = await dependencies.resolveApiKey(headers);
      if (apiKey === "invalid") {
        return { kind: "unauthorized" };
      }
      if (apiKey !== null) {
        return {
          caller: {
            scopes: apiKey.scopes,
            userId: apiKey.userId,
            workspace: apiKey.workspace,
          },
          kind: "caller",
        };
      }
    }
    const session = await dependencies.getSession(headers);
    if (session === null) {
      return { kind: "unauthorized" };
    }
    const workspace = await dependencies.findCurrentWorkspace(session.user.id);
    if (workspace === null) {
      return { kind: "noWorkspace" };
    }
    return {
      caller: { scopes: null, userId: session.user.id, workspace },
      kind: "caller",
    };
  }

  function unauthorized() {
    return errorResponse(dependencies, 401, "unauthorized", "Authentication is required.");
  }

  function noWorkspace() {
    return errorResponse(dependencies, 404, "notFound", "No workspace is available.");
  }

  function scopeDenied() {
    return errorResponse(
      dependencies,
      403,
      "forbidden",
      "The API key does not include the required scope.",
    );
  }

  function hasScope(caller: ResolvedCaller, scope: "read" | "write"): boolean {
    return caller.scopes === null || caller.scopes.includes(scope);
  }

  return Object.freeze({
    openapi(): Readonly<{ body: SupastackOpenApiDocument; status: 200 }> {
      return { body: openApiDocument, status: 200 };
    },

    async currentWorkspace(headers: Headers) {
      const auth = await resolveCaller(headers);
      if (auth.kind === "unauthorized") {
        return unauthorized();
      }
      if (auth.kind === "noWorkspace") {
        return noWorkspace();
      }
      if (!hasScope(auth.caller, "read")) {
        return scopeDenied();
      }
      return {
        body: {
          createdAt: auth.caller.workspace.createdAt.toISOString(),
          name: auth.caller.workspace.name,
          workspaceId: auth.caller.workspace.workspaceId,
        },
        status: 200 as const,
      };
    },

    async entitlements(headers: Headers) {
      const auth = await resolveCaller(headers);
      if (auth.kind === "unauthorized") {
        return unauthorized();
      }
      if (auth.kind === "noWorkspace") {
        return noWorkspace();
      }
      if (!hasScope(auth.caller, "read")) {
        return scopeDenied();
      }
      return {
        body: {
          data: await dependencies.listEntitlements(auth.caller.workspace.workspaceId),
        },
        status: 200 as const,
      };
    },

    async modelRequirements(headers: Headers) {
      const auth = await resolveCaller(headers);
      if (auth.kind === "unauthorized") {
        return unauthorized();
      }
      if (auth.kind === "noWorkspace") {
        return noWorkspace();
      }
      if (!hasScope(auth.caller, "read")) {
        return scopeDenied();
      }
      return {
        body: {
          data: {
            structuredOutput: true,
            tools: true,
            vision: true,
          },
        },
        status: 200 as const,
      };
    },

    async createAiTask(headers: Headers, rawBody: unknown) {
      const auth = await resolveCaller(headers);
      if (auth.kind === "unauthorized") {
        return unauthorized();
      }
      if (auth.kind === "noWorkspace") {
        return noWorkspace();
      }
      if (!hasScope(auth.caller, "write")) {
        return scopeDenied();
      }
      const workspace = auth.caller.workspace;
      const parsed = parseCreateBody(rawBody);
      if (parsed === null) {
        return errorResponse(
          dependencies,
          400,
          "validationError",
          "A valid AI task request is required.",
        );
      }
      if (parsed.workspaceId !== workspace.workspaceId) {
        return errorResponse(
          dependencies,
          403,
          "forbidden",
          "The request workspace does not match the current workspace.",
        );
      }

      try {
        const task = await dependencies.createAiTask({
          alias: parsed.alias,
          caller: { userId: auth.caller.userId, workspaceId: workspace.workspaceId },
          headers,
          prompt: parsed.prompt,
          requirements: parsed.requirements,
          workspaceId: workspace.workspaceId,
        });
        return { body: task, status: 201 as const };
      } catch (error) {
        if (error instanceof ApiV1DependencyError) {
          return errorResponse(dependencies, error.status, error.code, error.message);
        }
        return errorResponse(
          dependencies,
          500,
          "internalError",
          "The AI task could not be queued.",
        );
      }
    },

    async readAiTask(headers: Headers, taskId: string) {
      const auth = await resolveCaller(headers);
      if (auth.kind === "unauthorized") {
        return unauthorized();
      }
      if (auth.kind === "noWorkspace") {
        return noWorkspace();
      }
      if (!hasScope(auth.caller, "read")) {
        return scopeDenied();
      }
      const task = await dependencies.readAiTask({
        caller: { userId: auth.caller.userId, workspaceId: auth.caller.workspace.workspaceId },
        headers,
        taskId,
      });
      if (task === null || task.workspaceId !== auth.caller.workspace.workspaceId) {
        return errorResponse(dependencies, 404, "notFound", "The task was not found.");
      }
      return { body: task, status: 200 as const };
    },

    async readAiTaskResult(headers: Headers, taskId: string) {
      const auth = await resolveCaller(headers);
      if (auth.kind === "unauthorized") {
        return unauthorized();
      }
      if (auth.kind === "noWorkspace") {
        return noWorkspace();
      }
      if (!hasScope(auth.caller, "read")) {
        return scopeDenied();
      }
      const result = await dependencies.readAiTaskResult({
        caller: { userId: auth.caller.userId, workspaceId: auth.caller.workspace.workspaceId },
        headers,
        taskId,
      });
      if (
        result === null ||
        (result !== "notReady" && result.workspaceId !== auth.caller.workspace.workspaceId)
      ) {
        return errorResponse(dependencies, 404, "notFound", "The task was not found.");
      }
      if (result === "notReady") {
        return errorResponse(
          dependencies,
          409,
          "conflict",
          "The task result is not available yet.",
        );
      }
      return { body: result, status: 200 as const };
    },
  });
}

export class ApiV1DependencyError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 429 | 500,
    readonly code: ApiV1ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiV1DependencyError";
  }
}

export function createApiV1RequestId(): string {
  return randomUUID();
}
