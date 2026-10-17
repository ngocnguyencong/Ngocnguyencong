import { describe, expect, it } from "vitest";

import {
  aiTaskResultSchema,
  aiTaskSchema,
  apiErrorSchema,
  createAiTaskRequestSchema,
  currentWorkspaceSchema,
  entitlementSchema,
  modelRequirementsSchema,
  openApiDocument,
} from "./index.js";

const workspaceId = "ed3e5d31-a70e-4734-a2c7-9b0f4f5bc4ba";
const taskId = "681585f8-4ca3-4456-8d15-5fc994bf0bcd";

describe("API V1 resource schemas", () => {
  it("accepts camelCase current workspace and entitlement resources", () => {
    expect(
      currentWorkspaceSchema.parse({
        createdAt: "2026-09-03T12:00:00.000Z",
        name: "Personal workspace",
        workspaceId,
      }),
    ).toMatchObject({ workspaceId });

    expect(
      entitlementSchema.parse({
        entitlementId: "06a54de0-0ffd-46e3-accc-fd43e2ba1d0f",
        productKey: "starter-pro",
        status: "active",
        workspaceId,
      }),
    ).toMatchObject({ status: "active", workspaceId });
  });

  it("accepts the persisted billing entitlement status domain", () => {
    for (const status of ["active", "trialing", "past_due", "inactive"] as const) {
      expect(
        entitlementSchema.safeParse({
          entitlementId: "06a54de0-0ffd-46e3-accc-fd43e2ba1d0f",
          productKey: "starter-pro",
          status,
          workspaceId,
        }).success,
      ).toBe(true);
    }
    for (const status of ["gracePeriod", "expired", "revoked"]) {
      expect(
        entitlementSchema.safeParse({
          entitlementId: "06a54de0-0ffd-46e3-accc-fd43e2ba1d0f",
          productKey: "starter-pro",
          status,
          workspaceId,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects snake_case task payloads to keep JSON fields camelCase", () => {
    expect(
      createAiTaskRequestSchema.safeParse({
        alias: "smart",
        input: { prompt: "Write a greeting" },
        requirements: { tools: true },
        workspace_id: workspaceId,
      }).success,
    ).toBe(false);
  });

  it("validates create, status, result, and model requirements contracts", () => {
    const requirements = modelRequirementsSchema.parse({
      minContext: 32_000,
      structuredOutput: true,
      tools: true,
    });

    expect(
      createAiTaskRequestSchema.parse({
        alias: "smart",
        input: { prompt: "Return valid JSON" },
        requirements,
        workspaceId,
      }),
    ).toMatchObject({ workspaceId });

    expect(
      createAiTaskRequestSchema.safeParse({
        alias: "smart",
        input: { prompt: "legacy" },
        modelRequirements: { requiredCapabilities: ["structuredOutput"] },
        workspaceId,
      }).success,
    ).toBe(false);
    expect(
      aiTaskSchema.parse({
        createdAt: "2026-09-03T12:00:00.000Z",
        status: "running",
        taskId,
        workspaceId,
      }),
    ).toMatchObject({ status: "running", taskId });
    expect(
      aiTaskResultSchema.parse({
        completedAt: "2026-09-03T12:00:02.000Z",
        output: { greeting: "Hello" },
        taskId,
        workspaceId,
      }),
    ).toMatchObject({ taskId, workspaceId });
  });

  it("uses the standard error envelope", () => {
    expect(
      apiErrorSchema.parse({
        error: {
          code: "validationError",
          details: { field: "workspaceId" },
          message: "Request validation failed",
          requestId: "c4558191-2d9a-445a-a7aa-6fa9e1e85755",
        },
      }),
    ).toMatchObject({
      error: { code: "validationError", requestId: "c4558191-2d9a-445a-a7aa-6fa9e1e85755" },
    });
  });
});

describe("OpenAPI V1 document", () => {
  it("generates resource-oriented API V1 paths from the Zod registry", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
    expect(openApiDocument.paths).toMatchObject({
      "/api/v1/ai-tasks": { post: expect.any(Object) },
      "/api/v1/ai-tasks/{taskId}": { get: expect.any(Object) },
      "/api/v1/ai-tasks/{taskId}/result": { get: expect.any(Object) },
      "/api/v1/entitlements": { get: expect.any(Object) },
      "/api/v1/models/requirements": { get: expect.any(Object) },
      "/api/v1/workspaces/current": { get: expect.any(Object) },
    });
    expect(openApiDocument.paths["/api/v1/ai-tasks"]?.post?.responses).toHaveProperty("400");
  });
});
