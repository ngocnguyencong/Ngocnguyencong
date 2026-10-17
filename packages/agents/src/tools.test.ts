import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createToolRegistry, defineTool, type ToolDefinition } from "./tools.js";

const context = {
  scopes: ["read", "write"],
  userId: "user-1",
  workspaceId: "workspace-1",
} as const;

function echoTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return defineTool({
    name: "echo",
    title: "Echo",
    description: "Echoes the input text.",
    scope: "read",
    inputSchema: z.object({ text: z.string() }),
    async execute(input) {
      return { echoed: input.text };
    },
    ...overrides,
  });
}

describe("defineTool", () => {
  it("returns a frozen definition with a validated snake_case name", () => {
    const tool = echoTool();

    expect(tool.name).toBe("echo");
    expect(Object.isFrozen(tool)).toBe(true);
    expect(() => {
      (tool as { name: string }).name = "other";
    }).toThrow();
  });

  it.each(["Echo", "1echo", "echo!", "e", "a".repeat(65)])(
    "rejects the invalid tool name %s",
    (name) => {
      expect(() => echoTool({ name })).toThrow(/tool name/i);
    },
  );

  it("executes against the validated input with the caller context", async () => {
    const tool = echoTool();

    await expect(
      tool.execute(tool.inputSchema.parse({ text: "hi" }), { ...context }),
    ).resolves.toEqual({ echoed: "hi" });
  });
});

describe("createToolRegistry", () => {
  it("lists tools and finds them by name", () => {
    const registry = createToolRegistry([echoTool(), echoTool({ name: "other", scope: "write" })]);

    expect(registry.list().map((tool) => tool.name)).toEqual(["echo", "other"]);
    expect(registry.get("echo")?.scope).toBe("read");
    expect(registry.get("missing")).toBeUndefined();
  });

  it("throws on duplicate tool names", () => {
    expect(() => createToolRegistry([echoTool(), echoTool()])).toThrow(/duplicate/i);
  });

  it("filters tools by the caller scopes", () => {
    const registry = createToolRegistry([
      echoTool({ name: "reader", scope: "read" }),
      echoTool({ name: "writer", scope: "write" }),
    ]);

    expect(registry.forScopes(["read"]).map((tool) => tool.name)).toEqual(["reader"]);
    expect(registry.forScopes(["read", "write"]).map((tool) => tool.name)).toEqual([
      "reader",
      "writer",
    ]);
    expect(registry.forScopes([])).toEqual([]);
  });
});
