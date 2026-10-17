import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("expo/fetch", () => ({ fetch: mocks.fetch }));

import { fetch as expoFetch } from "expo/fetch";

import { streamChatReply } from "./stream";

describe("streamChatReply", () => {
  beforeEach(() => mocks.fetch.mockReset());

  it("forwards alias, structured output, and cancellation to the chat endpoint", async () => {
    mocks.fetch.mockResolvedValue(
      new Response('data: {"type":"chunk","text":"ok"}\n\ndata: {"type":"done"}\n\n'),
    );
    const controller = new AbortController();
    const events: unknown[] = [];

    await streamChatReply({
      alias: "smart",
      apiUrl: "https://app.example.test",
      cookie: "session=secret",
      onEvent: (event) => events.push(event),
      prompt: "Return JSON",
      signal: controller.signal,
      structuredOutput: true,
      threadId: "thread-1",
    });

    expect(vi.mocked(expoFetch)).toHaveBeenCalledWith(
      "https://app.example.test/api/chat/stream",
      expect.objectContaining({
        body: JSON.stringify({
          alias: "smart",
          prompt: "Return JSON",
          requirements: { structuredOutput: true },
          threadId: "thread-1",
        }),
        signal: controller.signal,
      }),
    );
    expect(events).toEqual([{ text: "ok", type: "chunk" }, { type: "done" }]);
  });
});
