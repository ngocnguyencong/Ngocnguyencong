import { describe, expect, it, vi } from "vitest";

import {
  createProductionAiClient,
  ProductionAiClientError,
  type ProductionAiTaskInput,
} from "./production-ai-client";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const taskInput: ProductionAiTaskInput = {
  alias: "smart",
  prompt: "Summarize the acceptance criteria.",
  requirements: {
    minContext: 4_000,
    structuredOutput: true,
    tools: false,
    vision: false,
  },
};

describe("production AI browser client", () => {
  it("retains keyed pending dispatch and resumes without sending a replacement prompt", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("idempotency-key")).toBe("request_1234567890");
      return jsonResponse({ data: { id: "task_123", status: "queued" } }, { status: 202 });
    });
    const client = createProductionAiClient(fetcher);
    await expect(client.createTask(taskInput, "request_1234567890")).resolves.toMatchObject({
      dispatchPending: true,
    });
    await expect(client.resumeTask("request_1234567890")).resolves.toMatchObject({
      dispatchPending: true,
    });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ resume: true });
  });
  it("posts only browser-safe task fields and projects the accepted task", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe("/api/ai/tasks");
      expect(init?.method).toBe("POST");
      expect(init?.credentials).toBe("same-origin");
      expect(JSON.parse(String(init?.body))).toEqual(taskInput);
      return jsonResponse(
        {
          data: {
            id: "task_123",
            providerRunId: "run_secret",
            status: "queued",
            workspaceId: "workspace_secret",
          },
        },
        { status: 201 },
      );
    });

    const task = await createProductionAiClient(fetcher).createTask(taskInput);

    expect(task).toEqual({ id: "task_123", output: null, status: "queued" });
  });

  it("rejects a completed create response without text output", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        { data: { id: "task_123", result: null, status: "completed" } },
        { status: 201 },
      ),
    );

    await expect(createProductionAiClient(fetcher).createTask(taskInput)).rejects.toEqual(
      new ProductionAiClientError("The AI task could not be queued."),
    );
  });

  it("reads a task and extracts successful text output without exposing metadata", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe("/api/ai/tasks/task_123");
      expect(init?.method).toBe("GET");
      expect(init?.cache).toBe("no-store");
      expect(init?.credentials).toBe("same-origin");
      return jsonResponse({
        data: {
          id: "task_123",
          result: {
            model: { id: "model_secret" },
            text: "The acceptance criteria are covered.",
          },
          status: "completed",
          workspaceId: "workspace_secret",
        },
      });
    });

    await expect(createProductionAiClient(fetcher).readTask("task_123")).resolves.toEqual({
      id: "task_123",
      output: "The acceptance criteria are covered.",
      status: "completed",
    });
  });

  it("rejects a read response for a different task ID", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        data: { id: "task_other", result: { text: "wrong task" }, status: "completed" },
      }),
    );

    await expect(createProductionAiClient(fetcher).readTask("task_123")).rejects.toEqual(
      new ProductionAiClientError("The task status could not be loaded."),
    );
  });

  it("rejects a completed read response without text output", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ data: { id: "task_123", result: null, status: "completed" } }),
    );

    await expect(createProductionAiClient(fetcher).readTask("task_123")).rejects.toEqual(
      new ProductionAiClientError("The task status could not be loaded."),
    );
  });

  it("returns a generic error for an unsuccessful response", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ error: { message: "database password leaked" } }, { status: 500 }),
    );

    await expect(createProductionAiClient(fetcher).readTask("task_123")).rejects.toEqual(
      expect.objectContaining({
        message: "The task status could not be loaded.",
        status: 500,
      }),
    );
  });

  it("maps known route errors to fixed safe copy instead of trusting response text", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        { error: { code: "notFound", message: "private provider details" } },
        { status: 404 },
      ),
    );

    await expect(createProductionAiClient(fetcher).readTask("task_123")).rejects.toEqual(
      expect.objectContaining({
        message: "The task was not found.",
        status: 404,
      }),
    );
  });

  it("falls back for unrecognized error codes, including inherited object keys", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        { error: { code: "toString", message: "private provider details" } },
        { status: 500 },
      ),
    );

    await expect(createProductionAiClient(fetcher).readTask("task_123")).rejects.toEqual(
      expect.objectContaining({
        message: "The task status could not be loaded.",
        status: 500,
      }),
    );
  });

  it("rejects malformed responses with an operation-specific generic error", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ data: { id: "task_123" } }));

    await expect(createProductionAiClient(fetcher).readTask("task_123")).rejects.toEqual(
      new ProductionAiClientError("The task status could not be loaded."),
    );
  });
});
