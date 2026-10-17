import { describe, expect, it } from "vitest";

import {
  appendUserMessage,
  beginAssistantTurn,
  clearChatSession,
  completeAssistantTurn,
  createChatSession,
  failAssistantTurn,
  markTurnPending,
} from "./web-chat-session.js";

describe("chat session reducers", () => {
  it("starts idle with default alias and no messages", () => {
    const session = createChatSession();
    expect(session).toMatchObject({
      alias: "fast",
      error: null,
      messages: [],
      pendingTaskId: null,
      status: "idle",
      structuredOutput: false,
    });
  });

  it("appends a trimmed user message and clears prior error", () => {
    const withError = failAssistantTurn(
      beginAssistantTurn(appendUserMessage(createChatSession(), "hi"), "task_1"),
      "boom",
    );
    const next = appendUserMessage(withError, "  Hello world  ");
    expect(next.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "user", content: "Hello world" },
    ]);
    expect(next.error).toBeNull();
    expect(next.status).toBe("idle");
    expect(next.pendingTaskId).toBeNull();
  });

  it("rejects blank user messages", () => {
    expect(() => appendUserMessage(createChatSession(), "   ")).toThrow(/message/i);
  });

  it("tracks a pending assistant turn then completes with reply", () => {
    const waiting = markTurnPending(appendUserMessage(createChatSession(), "Ping"));
    expect(waiting.status).toBe("pending");
    expect(waiting.pendingTaskId).toBeNull();

    const pending = beginAssistantTurn(waiting, "task_abc");
    expect(pending.status).toBe("pending");
    expect(pending.pendingTaskId).toBe("task_abc");

    const done = completeAssistantTurn(pending, "Pong");
    expect(done.status).toBe("idle");
    expect(done.pendingTaskId).toBeNull();
    expect(done.messages).toEqual([
      { role: "user", content: "Ping" },
      { role: "assistant", content: "Pong" },
    ]);
  });

  it("records failure without inventing an assistant reply", () => {
    const failed = failAssistantTurn(
      beginAssistantTurn(appendUserMessage(createChatSession(), "Ping"), "task_abc"),
      "An active AI entitlement is required.",
    );
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("An active AI entitlement is required.");
    expect(failed.messages).toEqual([{ role: "user", content: "Ping" }]);
    expect(failed.pendingTaskId).toBeNull();
  });

  it("clears the transcript", () => {
    const cleared = clearChatSession(
      completeAssistantTurn(
        beginAssistantTurn(appendUserMessage(createChatSession(), "Ping"), "task_1"),
        "Pong",
      ),
    );
    expect(cleared.messages).toEqual([]);
    expect(cleared.status).toBe("idle");
  });
});
