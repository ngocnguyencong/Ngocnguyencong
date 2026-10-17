export type ProductionAlias = "fast" | "smart" | "cheap";

export type ProductionAiTaskInput = Readonly<{
  alias: ProductionAlias;
  prompt: string;
  requirements: Readonly<{
    minContext?: number;
    structuredOutput?: boolean;
    tools?: boolean;
    vision?: boolean;
  }>;
}>;

export type ProductionTaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type ProductionTask = Readonly<{
  dispatchPending?: boolean;
  id: string;
  output: string | null;
  status: ProductionTaskStatus;
}>;

export class ProductionAiClientError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProductionAiClientError";
    this.status = status;
  }
}

type ProductionFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createProductionAiClient(fetcher: ProductionFetcher = browserFetcher) {
  return Object.freeze({
    createTask: (input: ProductionAiTaskInput, submissionKey?: string) =>
      requestTask(
        fetcher,
        "/api/ai/tasks",
        {
          body: JSON.stringify({
            alias: input.alias,
            prompt: input.prompt,
            requirements: input.requirements,
          }),
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            ...(submissionKey ? { "idempotency-key": submissionKey } : {}),
          },
          method: "POST",
        },
        "The AI task could not be queued.",
      ),
    resumeTask: (submissionKey: string) =>
      requestTask(
        fetcher,
        "/api/ai/tasks",
        {
          body: JSON.stringify({ resume: true }),
          credentials: "same-origin",
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": submissionKey },
        },
        "The submission could not be resumed.",
      ),
    readTask: (taskId: string) =>
      requestTask(
        fetcher,
        `/api/ai/tasks/${encodeURIComponent(taskId)}`,
        { cache: "no-store", credentials: "same-origin", method: "GET" },
        "The task status could not be loaded.",
        taskId,
      ),
  });
}

async function requestTask(
  fetcher: ProductionFetcher,
  path: string,
  init: RequestInit,
  genericMessage: string,
  expectedTaskId?: string,
): Promise<ProductionTask> {
  let response: Response;
  try {
    response = await fetcher(path, init);
  } catch {
    throw new ProductionAiClientError(genericMessage);
  }

  if (!response.ok) {
    throw new ProductionAiClientError(
      await responseErrorMessage(response, genericMessage),
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ProductionAiClientError(genericMessage);
  }

  const task = parseTask(payload);
  if (
    task === null ||
    (expectedTaskId !== undefined &&
      (task.id !== expectedTaskId || (task.status === "completed" && task.output === null)))
  ) {
    throw new ProductionAiClientError(genericMessage);
  }
  return response.status === 202 ? { ...task, dispatchPending: true } : task;
}

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return fallback;
  }

  if (!isRecord(payload) || !isRecord(payload.error) || typeof payload.error.code !== "string") {
    return fallback;
  }

  switch (payload.error.code) {
    case "idempotencyConflict":
      return "This submission key was used for a different request.";
    case "unauthorized":
      return "Authentication is required.";
    case "forbidden":
      return "The request origin is not allowed.";
    case "workspaceUnavailable":
      return "No workspace is available.";
    case "entitlementRequired":
      return "An active AI entitlement is required.";
    case "notFound":
      return "The task was not found.";
    case "providerUnavailable":
      return "The production worker is not configured.";
    case "validationError":
      return "A valid AI task request is required.";
    default:
      return fallback;
  }
}

function parseTask(payload: unknown): ProductionTask | null {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null;
  }

  const task = payload.data;
  if (typeof task.id !== "string" || task.id.length === 0 || !isTaskStatus(task.status)) {
    return null;
  }

  if (task.result !== undefined && task.result !== null && !isRecord(task.result)) {
    return null;
  }

  const result = isRecord(task.result) ? task.result : null;
  const output = result !== null && typeof result.text === "string" ? result.text : null;
  if (task.status === "completed" && output === null) {
    return null;
  }

  return {
    id: task.id,
    output,
    status: task.status,
  };
}

function isTaskStatus(value: unknown): value is ProductionTaskStatus {
  return (
    value === "queued" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const browserFetcher: ProductionFetcher = (input, init) => globalThis.fetch(input, init);
