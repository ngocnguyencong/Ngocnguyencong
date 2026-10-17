import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  resolveChatScope: vi.fn(),
  appendChatMessage: vi.fn(),
}));

vi.mock("../../../../../../src/auth-runtime", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("../../../../../../src/chat-api", () => ({
  appendChatMessage: mocks.appendChatMessage,
  resolveChatScope: mocks.resolveChatScope,
}));

import { MAX_JSON_BODY_BYTES } from "../../../../../../src/request-body";
import { POST } from "./route";

const context = (threadId: string) => ({ params: Promise.resolve({ threadId }) });

function oversizedJsonRequest(url: string, payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.subarray(0, 12));
      controller.enqueue(bytes.subarray(12, MAX_JSON_BODY_BYTES + 1));
      controller.enqueue(bytes.subarray(MAX_JSON_BODY_BYTES + 1));
      controller.close();
    },
  });
  return new Request(url, {
    body,
    duplex: "half",
    headers: { "content-length": "1", "content-type": "application/json" },
    method: "POST",
  } as RequestInit);
}

beforeEach(() => {
  mocks.getAuthSession.mockResolvedValue({ user: { id: "user_1" } });
  mocks.resolveChatScope.mockResolvedValue({ userId: "user_1", workspaceId: "ws_1" });
  mocks.appendChatMessage.mockResolvedValue({ message: { id: "message_1" } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/chat/threads/[threadId]/messages", () => {
  it("rejects an oversized body for a dotted thread ID before appending", async () => {
    const request = oversizedJsonRequest(
      "https://app.test/api/chat/threads/thread.with.dot/messages",
      { content: "x".repeat(MAX_JSON_BODY_BYTES), role: "user" },
    );

    const response = await POST(request, context("thread.with.dot"));

    expect(response.status).toBe(413);
    expect(mocks.appendChatMessage).not.toHaveBeenCalled();
  });

  it("continues to accept valid JSON and reject malformed JSON", async () => {
    const valid = await POST(
      new Request("https://app.test/api/chat/threads/thread.with.dot/messages", {
        method: "POST",
        body: JSON.stringify({ content: "Hello", role: "user" }),
      }),
      context("thread.with.dot"),
    );
    const invalid = await POST(
      new Request("https://app.test/api/chat/threads/thread.with.dot/messages", {
        method: "POST",
        body: "{",
      }),
      context("thread.with.dot"),
    );

    expect(valid.status).toBe(201);
    expect(invalid.status).toBe(400);
  });
});
