import type { ToolContext, ToolDefinition } from "./tools.js";

export interface RecordedToolCall {
  readonly name: string;
  readonly input: unknown;
}

export class ToolScopeDeniedError extends Error {
  constructor(tool: ToolDefinition) {
    super(`Tool "${tool.name}" requires the "${tool.scope}" scope.`);
    this.name = "ToolScopeDeniedError";
  }
}

/**
 * The single execution path every framework adapter routes through: zod
 * validation, scope enforcement (defense in depth — the registry should
 * already have filtered), call recording, and context injection. The model
 * never supplies workspaceId or userId.
 */
export async function executeToolCall(
  tool: ToolDefinition,
  rawInput: unknown,
  context: ToolContext,
  calls: RecordedToolCall[],
): Promise<unknown> {
  if (!context.scopes.includes(tool.scope)) {
    throw new ToolScopeDeniedError(tool);
  }
  const input = tool.inputSchema.parse(rawInput);
  calls.push({ name: tool.name, input });
  return tool.execute(input, context);
}
