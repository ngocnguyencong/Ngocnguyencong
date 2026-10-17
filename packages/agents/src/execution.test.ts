import { describe, expect, it } from "vitest";
import { z } from "zod";

import { executeToolCall, type RecordedToolCall } from "./execution.js";
import { defineTool, type ToolContext } from "./tools.js";

const context: ToolContext = {
  scopes: ["read"],
  userId: "user-1",
  workspaceId: "workspace-1",
};

describe("executeToolCall", () => {
  it("parses the input, records the call, and injects the context", async () => {
    const calls: RecordedToolCall[] = [];
    let seen: ToolContext | undefined;
    const tool = defineTool({
      name: "whoami",
      title: "Who am I",
      description: "Returns the workspace and user from the context.",
      scope: "read",
      inputSchema: z.object({ note: z.string().optional() }),
      async execute(_input, ctx) {
        seen = ctx;
        return { workspaceId: ctx.workspaceId, userId: ctx.userId };
      },
    });

    const output = await executeToolCall(tool, {}, context, calls);

    expect(output).toEqual({ workspaceId: "workspace-1", userId: "user-1" });
    expect(seen).toBe(context);
    expect(calls).toEqual([{ name: "whoami", input: {} }]);
  });

  it("refuses a tool whose scope the context does not grant", async () => {
    const calls: RecordedToolCall[] = [];
    const tool = defineTool({
      name: "dangerous",
      title: "Dangerous",
      description: "Write-scoped tool.",
      scope: "write",
      inputSchema: z.object({}),
      async execute() {
        throw new Error("must not execute");
      },
    });

    await expect(executeToolCall(tool, {}, context, calls)).rejects.toThrow(/scope/i);
    expect(calls).toEqual([]);
  });

  it("rejects input that fails the tool schema without recording it", async () => {
    const calls: RecordedToolCall[] = [];
    let executed = false;
    const tool = defineTool({
      name: "strict",
      title: "Strict",
      description: "Requires text.",
      scope: "read",
      inputSchema: z.object({ text: z.string() }),
      async execute() {
        executed = true;
        return null;
      },
    });

    await expect(executeToolCall(tool, { text: 42 }, context, calls)).rejects.toThrow();
    expect(executed).toBe(false);
    expect(calls).toEqual([]);
  });
});
