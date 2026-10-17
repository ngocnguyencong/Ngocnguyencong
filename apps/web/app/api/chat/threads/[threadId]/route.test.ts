import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  resolveChatScope: vi.fn(),
  renameChatThread: vi.fn(),
  deleteChatThread: vi.fn(),
  listChatMessages: vi.fn(),
}));

vi.mock("../../../../../src/auth-runtime", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("../../../../../src/chat-api", () => ({
  deleteChatThread: mocks.deleteChatThread,
  listChatMessages: mocks.listChatMessages,
  renameChatThread: mocks.renameChatThread,
  resolveChatScope: mocks.resolveChatScope,
}));

import { MAX_JSON_BODY_BYTES } from "../../../../../src/request-body";
import { PATCH } from "./route";

const context = (threadId: string) => ({ params: Promise.resolve({ threadId }) });

function oversizedJsonRequest(url: string, method: string, payload: unknown) {
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
    method,
  } as RequestInit);
}

beforeEach(() => {
  mocks.getAuthSession.mockResolvedValue({ user: { id: "user_1" } });
  mocks.resolveChatScope.mockResolvedValue({ userId: "user_1", workspaceId: "ws_1" });
  mocks.renameChatThread.mockResolvedValue("renamed");
  mocks.deleteChatThread.mockReset();
  mocks.listChatMessages.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/chat/threads/[threadId]", () => {
  it("rejects an oversized body for a dotted thread ID before renaming", async () => {
    const request = oversizedJsonRequest(
      "https://app.test/api/chat/threads/thread.with.dot",
      "PATCH",
      { title: "x".repeat(MAX_JSON_BODY_BYTES) },
    );

    const response = await PATCH(request, context("thread.with.dot"));

    expect(response.status).toBe(413);
    expect(mocks.renameChatThread).not.toHaveBeenCalled();
  });

  it("continues to accept valid JSON and reject malformed JSON", async () => {
    const valid = await PATCH(
      new Request("https://app.test/api/chat/threads/thread.with.dot", {
        method: "PATCH",
        body: JSON.stringify({ title: "Renamed" }),
      }),
      context("thread.with.dot"),
    );
    const invalid = await PATCH(
      new Request("https://app.test/api/chat/threads/thread.with.dot", {
        method: "PATCH",
        body: "{",
      }),
      context("thread.with.dot"),
    );

    expect(valid.status).toBe(200);
    expect(invalid.status).toBe(400);
  });
});
