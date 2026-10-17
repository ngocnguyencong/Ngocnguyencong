import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveChatScope: vi.fn(async () => ({ userId: "user-1", workspaceId: "workspace-1" })),
  session: vi.fn(async () => ({ user: { id: "user-1" } })),
  streamChatReply: vi.fn<
    (
      scope: { userId: string; workspaceId: string },
      input: { alias: string; signal?: AbortSignal },
    ) => ReadableStream<Uint8Array>
  >(() => new ReadableStream<Uint8Array>()),
}));

vi.mock("../../../../src/auth-runtime", () => ({ getAuthSession: mocks.session }));
vi.mock("../../../../src/chat-api", () => ({ resolveChatScope: mocks.resolveChatScope }));
vi.mock("../../../../src/chat-stream-runtime", () => ({ streamChatReply: mocks.streamChatReply }));

import { POST } from "./route";

describe("POST /api/chat/stream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the request cancellation signal into the stream runtime", async () => {
    const controller = new AbortController();
    const request = new Request("https://app.example.test/api/chat/stream", {
      body: JSON.stringify({ alias: "smart", prompt: "hello" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.streamChatReply).toHaveBeenCalledWith(
      { userId: "user-1", workspaceId: "workspace-1" },
      expect.objectContaining({ alias: "smart", signal: expect.any(AbortSignal) }),
    );
    const forwarded = mocks.streamChatReply.mock.calls[0]?.[1].signal;
    expect(forwarded?.aborted).toBe(false);
    controller.abort();
    expect(forwarded?.aborted).toBe(true);
  });
});
