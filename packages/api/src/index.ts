import {
  extendZodWithOpenApi,
  OpenApiGeneratorV31,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const apiV1 = "/api/v1";

const identifierSchema = z.string().uuid();
const timestampSchema = z.string().datetime({ offset: true });
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const apiErrorCodeSchema = z
  .enum([
    "validationError",
    "unauthorized",
    "forbidden",
    "notFound",
    "conflict",
    "rateLimited",
    "internalError",
  ])
  .openapi("ApiErrorCode");

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: apiErrorCodeSchema,
        details: jsonObjectSchema.optional(),
        message: z.string().min(1),
        requestId: identifierSchema,
      })
      .strict(),
  })
  .strict()
  .openapi("ApiError");

export const currentWorkspaceSchema = z
  .object({
    createdAt: timestampSchema,
    name: z.string().min(1).max(120),
    workspaceId: identifierSchema,
  })
  .strict()
  .openapi("CurrentWorkspace");

export const entitlementSchema = z
  .object({
    entitlementId: identifierSchema,
    expiresAt: timestampSchema.nullish(),
    productKey: z.string().min(1).max(120),
    status: z.enum(["active", "trialing", "past_due", "inactive"]),
    workspaceId: identifierSchema,
  })
  .strict()
  .openapi("Entitlement");

export const modelRequirementsSchema = z
  .object({
    minContext: z.number().int().positive().optional(),
    structuredOutput: z.boolean().optional(),
    tools: z.boolean().optional(),
    vision: z.boolean().optional(),
  })
  .strict()
  .openapi("ModelRequirements");

export const createAiTaskRequestSchema = z
  .object({
    alias: z.enum(["fast", "smart", "cheap"]),
    input: jsonObjectSchema,
    requirements: modelRequirementsSchema,
    workspaceId: identifierSchema,
  })
  .strict()
  .openapi("CreateAiTaskRequest");

export const aiTaskSchema = z
  .object({
    createdAt: timestampSchema,
    error: z.string().min(1).optional(),
    status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
    taskId: identifierSchema,
    workspaceId: identifierSchema,
  })
  .strict()
  .openapi("AiTask");

export const aiTaskResultSchema = z
  .object({
    completedAt: timestampSchema,
    output: jsonObjectSchema,
    taskId: identifierSchema,
    workspaceId: identifierSchema,
  })
  .strict()
  .openapi("AiTaskResult");

const entitlementsResponseSchema = z
  .object({ data: z.array(entitlementSchema) })
  .strict()
  .openapi("EntitlementsResponse");
const modelRequirementsResponseSchema = z
  .object({ data: modelRequirementsSchema })
  .strict()
  .openapi("ModelRequirementsResponse");
const taskPathParametersSchema = z.object({ taskId: identifierSchema }).strict();

const registry = new OpenAPIRegistry();
registry.register("ApiError", apiErrorSchema);
registry.register("CurrentWorkspace", currentWorkspaceSchema);
registry.register("Entitlement", entitlementSchema);
registry.register("ModelRequirements", modelRequirementsSchema);
registry.register("CreateAiTaskRequest", createAiTaskRequestSchema);
registry.register("AiTask", aiTaskSchema);
registry.register("AiTaskResult", aiTaskResultSchema);

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});
const standardErrors = {
  "400": { content: jsonContent(apiErrorSchema), description: "Request validation failed" },
  "401": { content: jsonContent(apiErrorSchema), description: "Authentication is required" },
  "403": { content: jsonContent(apiErrorSchema), description: "Workspace access is forbidden" },
  "404": { content: jsonContent(apiErrorSchema), description: "Requested resource was not found" },
  "409": {
    content: jsonContent(apiErrorSchema),
    description: "Request conflicts with current state",
  },
  "429": { content: jsonContent(apiErrorSchema), description: "Request rate limit exceeded" },
  "500": { content: jsonContent(apiErrorSchema), description: "Unexpected server error" },
};

registry.registerPath({
  method: "get",
  path: `${apiV1}/workspaces/current`,
  responses: {
    "200": {
      content: jsonContent(currentWorkspaceSchema),
      description: "Current personal workspace",
    },
    "401": standardErrors["401"],
    "404": standardErrors["404"],
    "500": standardErrors["500"],
  },
  summary: "Get the current workspace",
  tags: ["Workspaces"],
});

registry.registerPath({
  method: "get",
  path: `${apiV1}/entitlements`,
  responses: {
    "200": {
      content: jsonContent(entitlementsResponseSchema),
      description: "Entitlements for the current workspace",
    },
    "401": standardErrors["401"],
    "500": standardErrors["500"],
  },
  summary: "List current workspace entitlements",
  tags: ["Entitlements"],
});

registry.registerPath({
  method: "get",
  path: `${apiV1}/models/requirements`,
  responses: {
    "200": {
      content: jsonContent(modelRequirementsResponseSchema),
      description: "Supported model requirement contract",
    },
    "401": standardErrors["401"],
    "500": standardErrors["500"],
  },
  summary: "Get model requirements",
  tags: ["Models"],
});

registry.registerPath({
  method: "post",
  path: `${apiV1}/ai-tasks`,
  request: {
    body: { content: jsonContent(createAiTaskRequestSchema), required: true },
  },
  responses: {
    "201": { content: jsonContent(aiTaskSchema), description: "AI task accepted for execution" },
    "400": standardErrors["400"],
    "401": standardErrors["401"],
    "403": standardErrors["403"],
    "409": standardErrors["409"],
    "429": standardErrors["429"],
    "500": standardErrors["500"],
  },
  summary: "Create an AI task",
  tags: ["AI tasks"],
});

registry.registerPath({
  method: "get",
  path: `${apiV1}/ai-tasks/{taskId}`,
  request: { params: taskPathParametersSchema },
  responses: {
    "200": { content: jsonContent(aiTaskSchema), description: "AI task status" },
    "401": standardErrors["401"],
    "403": standardErrors["403"],
    "404": standardErrors["404"],
    "500": standardErrors["500"],
  },
  summary: "Get AI task status",
  tags: ["AI tasks"],
});

registry.registerPath({
  method: "get",
  path: `${apiV1}/ai-tasks/{taskId}/result`,
  request: { params: taskPathParametersSchema },
  responses: {
    "200": { content: jsonContent(aiTaskResultSchema), description: "Completed AI task result" },
    "401": standardErrors["401"],
    "403": standardErrors["403"],
    "404": standardErrors["404"],
    "409": standardErrors["409"],
    "500": standardErrors["500"],
  },
  summary: "Get AI task result",
  tags: ["AI tasks"],
});

export interface SupastackOpenApiOperation {
  responses?: Record<string, unknown>;
}

export interface SupastackOpenApiPathItem {
  get?: SupastackOpenApiOperation;
  post?: SupastackOpenApiOperation;
}

export interface SupastackOpenApiDocument {
  info: Readonly<{ title: string; version: string }>;
  openapi: string;
  paths: Record<string, SupastackOpenApiPathItem | undefined>;
  servers?: ReadonlyArray<Readonly<{ url: string }>>;
}

const generatedOpenApiDocument = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  info: { title: "supastack API", version: "1.0.0" },
  openapi: "3.1.0",
  servers: [{ url: "/" }],
});

export const openApiDocument: SupastackOpenApiDocument = {
  ...generatedOpenApiDocument,
  paths: generatedOpenApiDocument.paths ?? {},
};

export * from "./local-golden-path";
