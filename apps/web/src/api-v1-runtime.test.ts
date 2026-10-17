import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  bff: null as {
    create: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  } | null,
  getSession: vi.fn(),
  resolveApiKey: vi.fn(),
  selectRows: new Map<unknown, unknown[]>(),
}));

vi.mock("@supastack/config", () => ({
  parseServerConfig: () => ({ app: { webUrl: "https://app.example.test" } }),
}));

vi.mock("./auth-runtime", () => ({
  database: {
    select: () => ({
      from: (table: unknown) => {
        const rows = dependencies.selectRows.get(table) ?? [];
        const builder = {
          innerJoin: () => builder,
          where: () => queryResult(rows),
        };
        return builder;
      },
    }),
  },
  getAuthSession: dependencies.getSession,
}));

vi.mock("./ai-task-runtime", () => ({
  get productionAiTaskBff() {
    return dependencies.bff;
  },
}));

vi.mock("./api-key-auth", () => ({
  resolveApiKeyCaller: dependencies.resolveApiKey,
}));

import { entitlement, taskRun, workspaceMembership } from "@supastack/db";

import { apiV1Bff } from "./api-v1-runtime";

function queryResult(rows: unknown[]) {
  const result = Promise.resolve(rows) as Promise<unknown[]> & {
    limit(count: number): Promise<unknown[]>;
    orderBy(): typeof result;
  };
  result.limit = async (count) => rows.slice(0, count);
  result.orderBy = () => result;
  return result;
}

const bearer = new Headers({ authorization: "Bearer sk_test_abc" });
const apiKeyCaller = Object.freeze({
  scopes: ["read", "write"],
  userId: "user-key-owner",
  workspace: {
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    name: "Key workspace",
    workspaceId: "workspace-key",
  },
});

function entitlementRow(status: string) {
  return {
    entitlementId: "ent_1",
    expiresAt: null,
    productKey: "ai.reference-task",
    status,
    workspaceId: "workspace-key",
  };
}

beforeEach(() => {
  dependencies.bff = { create: vi.fn(), read: vi.fn() };
  dependencies.getSession.mockReset().mockResolvedValue(null);
  dependencies.resolveApiKey.mockReset().mockResolvedValue(apiKeyCaller);
  dependencies.selectRows.clear();
});

describe("API v1 runtime entitlement statuses", () => {
  it.each(["active", "trialing", "past_due", "inactive"])(
    "returns persisted status %s without throwing",
    async (status) => {
      dependencies.selectRows.set(entitlement, [entitlementRow(status)]);

      await expect(apiV1Bff.entitlements(bearer)).resolves.toEqual({
        body: { data: [entitlementRow(status)] },
        status: 200,
      });
    },
  );

  it("maps unknown persisted statuses to inactive instead of throwing", async () => {
    dependencies.selectRows.set(entitlement, [entitlementRow("refunded")]);

    await expect(apiV1Bff.entitlements(bearer)).resolves.toEqual({
      body: { data: [{ ...entitlementRow("inactive") }] },
      status: 200,
    });
  });
});

describe("API v1 runtime AI task bridging", () => {
  const taskBody = {
    alias: "fast",
    input: { prompt: "Summarize." },
    requirements: {},
    workspaceId: "workspace-key",
  };

  it("creates with a fresh server-origin header set and the resolved caller", async () => {
    dependencies.bff!.create.mockResolvedValue({
      body: { data: { id: "task_1", status: "queued", workspaceId: "workspace-key" } },
      status: 201,
    });
    const headers = new Headers({
      authorization: "Bearer sk_test_abc",
      cookie: "session=spoofed",
      "idempotency-key": "request_1234567890",
      origin: "https://attacker.example.test",
    });

    await expect(apiV1Bff.createAiTask(headers, taskBody)).resolves.toMatchObject({
      status: 201,
    });

    expect(dependencies.bff!.create).toHaveBeenCalledWith(
      expect.any(Headers),
      { alias: "fast", prompt: "Summarize.", requirements: {} },
      { userId: "user-key-owner", workspaceId: "workspace-key" },
    );
    const forwarded = dependencies.bff!.create.mock.calls[0]![0] as Headers;
    expect(forwarded.get("origin")).toBe("https://app.example.test");
    expect(forwarded.get("idempotency-key")).toBe("request_1234567890");
    expect(forwarded.get("authorization")).toBeNull();
    expect(forwarded.get("cookie")).toBeNull();
  });

  it("omits the idempotency key when the client did not send one", async () => {
    dependencies.bff!.create.mockResolvedValue({
      body: { data: { id: "task_1", status: "queued", workspaceId: "workspace-key" } },
      status: 201,
    });

    await apiV1Bff.createAiTask(bearer, taskBody);

    const forwarded = dependencies.bff!.create.mock.calls[0]![0] as Headers;
    expect(forwarded.get("idempotency-key")).toBeNull();
  });

  it("passes the API-key caller to task reads without forwarding client headers", async () => {
    dependencies.bff!.read.mockResolvedValue({
      body: {
        data: {
          completedAt: null,
          id: "task_1",
          result: null,
          status: "queued",
          workspaceId: "workspace-key",
        },
      },
      status: 200,
    });
    dependencies.selectRows.set(taskRun, [
      { createdAt: new Date("2026-09-10T12:00:00.000Z"), errorCode: null },
    ]);

    await expect(apiV1Bff.readAiTask(bearer, "task_1")).resolves.toMatchObject({
      status: 200,
      body: { taskId: "task_1", workspaceId: "workspace-key" },
    });
    expect(dependencies.bff!.read).toHaveBeenCalledWith(expect.any(Headers), "task_1", {
      userId: "user-key-owner",
      workspaceId: "workspace-key",
    });
    const forwarded = dependencies.bff!.read.mock.calls[0]![0] as Headers;
    expect(forwarded.get("authorization")).toBeNull();
    expect(forwarded.get("cookie")).toBeNull();
  });

  it("reads results through the caller-scoped task lookup", async () => {
    dependencies.bff!.read.mockResolvedValue({
      body: {
        data: {
          completedAt: new Date("2026-09-10T12:01:00.000Z"),
          id: "task_1",
          result: { text: "done" },
          status: "completed",
          workspaceId: "workspace-key",
        },
      },
      status: 200,
    });

    await expect(apiV1Bff.readAiTaskResult(bearer, "task_1")).resolves.toMatchObject({
      status: 200,
      body: { output: { text: "done" }, workspaceId: "workspace-key" },
    });
    expect(dependencies.bff!.read).toHaveBeenCalledWith(expect.any(Headers), "task_1", {
      userId: "user-key-owner",
      workspaceId: "workspace-key",
    });
  });

  it("resolves the caller workspace for cookie sessions", async () => {
    dependencies.resolveApiKey.mockResolvedValue(null);
    dependencies.getSession.mockResolvedValue({ user: { id: "user-a" } });
    dependencies.selectRows.set(workspaceMembership, [
      {
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        name: "A workspace",
        workspaceId: "workspace-a",
      },
    ]);
    dependencies.bff!.create.mockResolvedValue({
      body: { data: { id: "task_1", status: "queued", workspaceId: "workspace-a" } },
      status: 201,
    });

    await expect(
      apiV1Bff.createAiTask(new Headers(), { ...taskBody, workspaceId: "workspace-a" }),
    ).resolves.toMatchObject({ status: 201 });
    expect(dependencies.bff!.create).toHaveBeenCalledWith(
      expect.any(Headers),
      { alias: "fast", prompt: "Summarize.", requirements: {} },
      { userId: "user-a", workspaceId: "workspace-a" },
    );
  });

  it.each([
    { code: "validationError", expectedCode: "validationError", status: 400 },
    { code: "entitlementRequired", expectedCode: "forbidden", status: 403 },
    { code: "notFound", expectedCode: "notFound", status: 404 },
    { code: "idempotencyConflict", expectedCode: "conflict", status: 409 },
    { code: "rateLimited", expectedCode: "rateLimited", status: 429 },
  ])(
    "surfaces a BFF $status ($code) as the matching API error",
    async ({ code, expectedCode, status }) => {
      dependencies.bff!.create.mockResolvedValue({
        body: { error: { code, message: "BFF refusal." } },
        status,
      });

      await expect(apiV1Bff.createAiTask(bearer, taskBody)).resolves.toMatchObject({
        body: { error: { code: expectedCode, message: "BFF refusal." } },
        status,
      });
    },
  );

  it("collapses an unmapped BFF failure to 500 internalError", async () => {
    dependencies.bff!.create.mockResolvedValue({
      body: { error: { code: "providerUnavailable", message: "Worker offline." } },
      status: 503,
    });

    await expect(apiV1Bff.createAiTask(bearer, taskBody)).resolves.toMatchObject({
      body: { error: { code: "internalError" } },
      status: 500,
    });
  });
});
