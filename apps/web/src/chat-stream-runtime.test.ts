import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  appendChatMessage: vi.fn(async () => "ok"),
  completeChat: vi.fn(),
  userCheck: vi.fn(async () => ({ allowed: false })),
  workspaceCheck: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("./ai-task-runtime", () => ({
  getChatStreamRuntime: () => ({ completeChat: mocks.completeChat }),
}));
vi.mock("./chat-api", () => ({ appendChatMessage: mocks.appendChatMessage }));
vi.mock("./rate-limit-runtime", () => ({
  aiTaskUserLimiter: { check: mocks.userCheck },
  aiTaskWorkspaceLimiter: { check: mocks.workspaceCheck },
}));

import { streamChatReply } from "./chat-stream-runtime";

describe("chat stream spend gate", () => {
  it("stops before model completion when the shared user bucket is exhausted", async () => {
    const stream = streamChatReply(
      { userId: "u_1", workspaceId: "ws_1" },
      { alias: "fast", prompt: "Hello" },
    );
    const reader = stream.getReader();
    const event = await reader.read();

    expect(new TextDecoder().decode(event.value)).toContain("Too many AI requests");
    expect(mocks.completeChat).not.toHaveBeenCalled();
    expect(mocks.workspaceCheck).not.toHaveBeenCalled();
  });

  it("aborts model work and suppresses assistant persistence and SSE errors", async () => {
    mocks.userCheck.mockResolvedValue({ allowed: true });
    mocks.workspaceCheck.mockResolvedValue({ allowed: true });
    mocks.appendChatMessage.mockClear();
    mocks.completeChat.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          signal.addEventListener(
            "abort",
            () =>
              reject(signal.reason ?? Object.assign(new Error("Aborted"), { name: "AbortError" })),
            { once: true },
          );
        }),
    );
    const requestController = new AbortController();
    const stream = streamChatReply(
      { userId: "u_1", workspaceId: "ws_1" },
      { alias: "smart", prompt: "Hello", signal: requestController.signal, threadId: "thread_1" },
    );
    const reader = stream.getReader();

    await vi.waitFor(() => expect(mocks.completeChat).toHaveBeenCalledTimes(1));
    const completionRequest = mocks.completeChat.mock.calls[0]![0];
    expect(completionRequest).toMatchObject({ alias: "smart", signal: expect.any(AbortSignal) });
    requestController.abort();

    const result = await reader.read();
    expect(result.done).toBe(true);
    expect(completionRequest.signal.aborted).toBe(true);
    expect(mocks.appendChatMessage).toHaveBeenCalledTimes(1);
    expect(mocks.appendChatMessage).toHaveBeenCalledWith(
      expect.any(Object),
      "thread_1",
      expect.objectContaining({ role: "user" }),
    );
  });
});
