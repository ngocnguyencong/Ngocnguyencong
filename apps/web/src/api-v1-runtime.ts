import "server-only";

import { parseServerConfig } from "@supastack/config";
import { entitlement, taskRun, workspace, workspaceMembership } from "@supastack/db";
import { and, asc, eq } from "drizzle-orm";

import { productionAiTaskBff } from "./ai-task-runtime";
import { resolveApiKeyCaller } from "./api-key-auth";
import {
  ApiV1DependencyError,
  createApiV1Bff,
  createApiV1RequestId,
  type ApiV1EntitlementStatus,
  type ApiV1TaskStatus,
} from "./api-v1-bff";
import { database, getAuthSession } from "./auth-runtime";

const serverConfig = parseServerConfig();

function toEntitlementStatus(status: string): ApiV1EntitlementStatus {
  if (
    status === "active" ||
    status === "inactive" ||
    status === "past_due" ||
    status === "trialing"
  ) {
    return status;
  }
  // Unknown persisted statuses fail closed: the list endpoint reports
  // "inactive" rather than throwing into an opaque 500.
  return "inactive";
}

function toTaskStatus(status: string): ApiV1TaskStatus {
  if (
    status === "queued" ||
    status === "running" ||
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    return status;
  }
  throw new Error("Unsupported task status.");
}

async function findCurrentWorkspace(userId: string) {
  const [row] = await database
    .select({
      createdAt: workspace.createdAt,
      name: workspace.name,
      workspaceId: workspace.id,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(eq(workspaceMembership.userId, userId))
    .orderBy(asc(workspaceMembership.createdAt))
    .limit(1);
  return row ?? null;
}

function mapBffError(response: { status: number; body: unknown }): never {
  const error =
    typeof response.body === "object" &&
    response.body !== null &&
    "error" in response.body &&
    typeof response.body.error === "object" &&
    response.body.error !== null
      ? (response.body.error as { code?: string; message?: string })
      : undefined;
  const code = error?.code ?? "internalError";
  const message = error?.message ?? "The AI task request failed.";
  const status =
    response.status === 400 ||
    response.status === 403 ||
    response.status === 404 ||
    response.status === 409 ||
    response.status === 429
      ? response.status
      : 500;
  throw new ApiV1DependencyError(
    status,
    code === "entitlementRequired" || code === "workspaceUnavailable" || code === "forbidden"
      ? "forbidden"
      : code === "validationError"
        ? "validationError"
        : code === "notFound"
          ? "notFound"
          : code === "idempotencyConflict"
            ? "conflict"
            : code === "rateLimited" || code === "quotaExceeded"
              ? "rateLimited"
              : "internalError",
    message,
  );
}

export const apiV1Bff = createApiV1Bff({
  createRequestId: createApiV1RequestId,
  getSession: getAuthSession,
  findCurrentWorkspace,
  resolveApiKey: resolveApiKeyCaller,
  listEntitlements: async (workspaceId) => {
    const rows = await database
      .select({
        entitlementId: entitlement.id,
        expiresAt: entitlement.expiresAt,
        productKey: entitlement.key,
        status: entitlement.status,
        workspaceId: entitlement.workspaceId,
      })
      .from(entitlement)
      .where(eq(entitlement.workspaceId, workspaceId));
    return rows.map((row) => ({
      entitlementId: row.entitlementId,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      productKey: row.productKey,
      status: toEntitlementStatus(row.status),
      workspaceId: row.workspaceId,
    }));
  },
  createAiTask: async ({ alias, caller, headers, prompt, requirements, workspaceId }) => {
    if (productionAiTaskBff === null) {
      throw new ApiV1DependencyError(
        500,
        "internalError",
        "The production worker is not configured.",
      );
    }
    const forwarded = new Headers();
    forwarded.set("origin", new URL(serverConfig.app.webUrl).origin);
    const idempotencyKey = headers.get("idempotency-key");
    if (idempotencyKey !== null) {
      forwarded.set("idempotency-key", idempotencyKey);
    }
    const response = await productionAiTaskBff.create(
      forwarded,
      {
        alias,
        prompt,
        requirements,
      },
      caller,
    );
    if (response.status >= 400) {
      mapBffError(response);
    }
    const data = "data" in response.body ? response.body.data : null;
    if (
      data === null ||
      typeof data !== "object" ||
      typeof data.id !== "string" ||
      typeof data.status !== "string" ||
      typeof data.workspaceId !== "string"
    ) {
      throw new ApiV1DependencyError(500, "internalError", "The AI task could not be queued.");
    }
    if (data.workspaceId !== workspaceId) {
      throw new ApiV1DependencyError(500, "internalError", "The AI task could not be queued.");
    }
    return {
      createdAt: new Date().toISOString(),
      status: toTaskStatus(data.status),
      taskId: data.id,
      workspaceId: data.workspaceId,
    };
  },
  readAiTask: async ({ caller, taskId }) => {
    if (productionAiTaskBff === null) {
      return null;
    }
    const response = await productionAiTaskBff.read(new Headers(), taskId, caller);
    if (response.status !== 200 || !("data" in response.body)) {
      return null;
    }
    const data = response.body.data;
    const [created] = await database
      .select({
        createdAt: taskRun.createdAt,
        errorCode: taskRun.errorCode,
      })
      .from(taskRun)
      .where(and(eq(taskRun.id, taskId), eq(taskRun.workspaceId, data.workspaceId)))
      .limit(1);
    return {
      createdAt: (created?.createdAt ?? new Date()).toISOString(),
      ...(created?.errorCode ? { error: created.errorCode } : {}),
      status: toTaskStatus(data.status),
      taskId: data.id,
      workspaceId: data.workspaceId,
    };
  },
  readAiTaskResult: async ({ caller, taskId }) => {
    if (productionAiTaskBff === null) {
      return null;
    }
    const response = await productionAiTaskBff.read(new Headers(), taskId, caller);
    if (response.status !== 200 || !("data" in response.body)) {
      return null;
    }
    const data = response.body.data;
    if (data.status !== "completed" || data.result === null || data.completedAt === null) {
      return "notReady";
    }
    return {
      completedAt: data.completedAt.toISOString(),
      output: data.result,
      taskId: data.id,
      workspaceId: data.workspaceId,
    };
  },
});
