import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  bff: { read: vi.fn() } as { read: ReturnType<typeof vi.fn> } | null,
  captureException: vi.fn(),
}));
vi.mock("./ai-task-runtime", () => ({
  get productionAiTaskBff() {
    return dependencies.bff;
  },
}));
vi.mock("./observability-runtime", () => ({
  serverObservability: { captureException: dependencies.captureException },
}));

import { GET } from "../app/api/ai/tasks/[taskId]/route";

const request = new Request("https://app.example.test/api/ai/tasks/task_private");
const context = () => ({ params: Promise.resolve({ taskId: "task_private" }) });

beforeEach(() => {
  dependencies.bff = { read: vi.fn() };
  dependencies.captureException.mockReset();
});

describe("AI task GET error boundary", () => {
  it("returns only a generic JSON error and reports no original exception data", async () => {
    dependencies.bff!.read.mockRejectedValue(
      new Error("postgres://secret:password", { cause: "private" }),
    );
    const response = await GET(request, context());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internalError", message: "The AI task could not be loaded." },
    });
    expect(dependencies.captureException).toHaveBeenCalledOnce();
    const [error, tags] = dependencies.captureException.mock.calls[0]!;
    expect(error.message).toBe("AI task read failed");
    expect(error.cause).toBeUndefined();
    expect(tags).toEqual({ operation: "ai.task.read", workspaceId: "system" });
    expect(error.stack).not.toContain("postgres://secret");
  });

  it("preserves the safe response even if reporting also fails", async () => {
    dependencies.bff!.read.mockRejectedValue(new Error("private database failure"));
    dependencies.captureException.mockImplementation(() => {
      throw new Error("reporter failure");
    });
    const response = await GET(request, context());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internalError", message: "The AI task could not be loaded." },
    });
  });

  it.each([200, 401, 404])(
    "preserves BFF status %i and forwards session headers",
    async (status) => {
      const body =
        status === 200
          ? { data: { id: "task_private", status: "queued" } }
          : { error: { code: "notFound" } };
      dependencies.bff!.read.mockResolvedValue({ body, status });
      const response = await GET(request, context());
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(body);
      expect(dependencies.bff!.read).toHaveBeenCalledWith(request.headers, "task_private");
      expect(dependencies.captureException).not.toHaveBeenCalled();
    },
  );

  it("returns503 without invoking unavailable worker composition", async () => {
    dependencies.bff = null;
    const response = await GET(request, context());
    expect(response.status).toBe(503);
    expect(dependencies.captureException).not.toHaveBeenCalled();
  });
});
