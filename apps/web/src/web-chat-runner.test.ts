import { describe, expect, it, vi } from "vitest";

import { createProductionAiClient } from "./production-ai-client.js";
import { runChatTurn } from "./web-chat-runner.js";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("runChatTurn", () => {
  it("posts a transcript prompt and polls until the assistant reply is ready", async () => {
    let reads = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === "/api/ai/tasks" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          alias: string;
          prompt: string;
          requirements: { structuredOutput?: boolean };
        };
        expect(body.alias).toBe("smart");
        expect(body.prompt).toContain("User: Hello");
        expect(body.prompt.trim().endsWith("Assistant:")).toBe(true);
        expect(body.requirements.structuredOutput).toBe(false);
        expect(Object.keys(body).sort()).toEqual(["alias", "prompt", "requirements"]);
        return jsonResponse({ data: { id: "task_chat_1", status: "queued" } }, { status: 201 });
      }

      expect(input).toBe("/api/ai/tasks/task_chat_1");
      reads += 1;
      if (reads === 1) {
        return jsonResponse({ data: { id: "task_chat_1", status: "running" } });
      }
      return jsonResponse({
        data: {
          id: "task_chat_1",
          result: { text: "Hi there." },
          status: "completed",
        },
      });
    });

    const result = await runChatTurn({
      alias: "smart",
      client: createProductionAiClient(fetcher),
      messages: [{ role: "user", content: "Hello" }],
      pollIntervalMs: 0,
      structuredOutput: false,
    });

    expect(result).toEqual({ reply: "Hi there.", taskId: "task_chat_1" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("requests structured output through requirements when enabled", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        prompt: string;
        requirements: { structuredOutput?: boolean };
      };
      expect(body.requirements.structuredOutput).toBe(true);
      expect(body.prompt).toMatch(/json/i);
      return jsonResponse({
        data: {
          id: "task_chat_2",
          result: { text: '{"items":["a","b"]}' },
          status: "completed",
        },
      });
    });

    await expect(
      runChatTurn({
        alias: "fast",
        client: createProductionAiClient(fetcher),
        messages: [{ role: "user", content: "List two items." }],
        pollIntervalMs: 0,
        structuredOutput: true,
      }),
    ).resolves.toMatchObject({ taskId: "task_chat_2" });
  });

  it("fails when the task ends without text", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ data: { id: "task_chat_3", status: "failed" } }),
    );

    await expect(
      runChatTurn({
        alias: "fast",
        client: createProductionAiClient(fetcher),
        messages: [{ role: "user", content: "Hello" }],
        pollIntervalMs: 0,
      }),
    ).rejects.toThrow(/could not be completed|failed/i);
  });
});
