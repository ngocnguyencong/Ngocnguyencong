import type { z } from "zod";

export type ToolScope = "read" | "write";

/**
 * Server-resolved identity for a tool run. Callers (agent runners, the MCP
 * endpoint) inject this; model-supplied input can never set workspaceId.
 */
export interface ToolContext {
  readonly workspaceId: string;
  readonly userId: string;
  readonly scopes: readonly ToolScope[];
}

export interface ToolDefinition<I extends z.ZodObject = z.ZodObject, O = unknown> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly scope: ToolScope;
  readonly inputSchema: I;
  execute(input: z.output<I>, context: ToolContext): Promise<O>;
}

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export class ToolDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolDefinitionError";
  }
}

export function defineTool<I extends z.ZodObject, O>(
  definition: ToolDefinition<I, O>,
): ToolDefinition<I, O> {
  if (!TOOL_NAME_PATTERN.test(definition.name)) {
    throw new ToolDefinitionError(
      `Invalid tool name "${definition.name}"; use snake_case (2-64 chars, starting with a letter).`,
    );
  }
  if (typeof definition.title !== "string" || definition.title.trim().length === 0) {
    throw new ToolDefinitionError(`Tool "${definition.name}" requires a title.`);
  }
  if (typeof definition.description !== "string" || definition.description.trim().length === 0) {
    throw new ToolDefinitionError(`Tool "${definition.name}" requires a description.`);
  }
  if (typeof definition.execute !== "function") {
    throw new ToolDefinitionError(`Tool "${definition.name}" requires an execute function.`);
  }
  return Object.freeze(definition);
}

export interface ToolRegistry {
  list(): readonly ToolDefinition[];
  forScopes(scopes: readonly ToolScope[]): readonly ToolDefinition[];
  get(name: string): ToolDefinition | undefined;
}

export function createToolRegistry(tools: readonly ToolDefinition[]): ToolRegistry {
  const byName = new Map<string, ToolDefinition>();
  for (const tool of tools) {
    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      throw new ToolDefinitionError(
        `Invalid tool name "${tool.name}"; use snake_case (2-64 chars, starting with a letter).`,
      );
    }
    if (byName.has(tool.name)) {
      throw new ToolDefinitionError(`Duplicate tool name "${tool.name}".`);
    }
    byName.set(tool.name, tool);
  }

  const all = Object.freeze([...byName.values()]);
  return Object.freeze({
    list: () => all,
    forScopes: (scopes: readonly ToolScope[]) => all.filter((tool) => scopes.includes(tool.scope)),
    get: (name: string) => byName.get(name),
  });
}
