import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { createTool } from "@mastra/core/tools";

import { executeToolCall, type RecordedToolCall } from "../execution";
import {
  DEFAULT_AGENT_MAX_STEPS,
  type AgentModelSource,
  type AgentRunInput,
  type AgentRunner,
} from "../runtime";

export function createMastraRunner(model: AgentModelSource): AgentRunner {
  return {
    framework: "mastra",
    async run(input: AgentRunInput) {
      const calls: RecordedToolCall[] = [];
      const tools = Object.fromEntries(
        input.tools.map((definition) => [
          definition.name,
          createTool({
            id: definition.name,
            description: definition.description,
            inputSchema: definition.inputSchema,
            execute: async (inputData) =>
              executeToolCall(definition, inputData, input.context, calls),
          }),
        ]),
      );

      const agent = new Agent({
        id: "supastack-agent",
        name: "supastack-agent",
        instructions: input.instructions,
        model: model.languageModel as MastraModelConfig,
        tools,
      });

      const result = await agent.generate(input.prompt, {
        maxSteps: input.maxSteps ?? DEFAULT_AGENT_MAX_STEPS,
        ...(input.signal === undefined ? {} : { abortSignal: input.signal }),
      });

      const inputTokens = result.totalUsage?.inputTokens;
      const outputTokens = result.totalUsage?.outputTokens;
      return {
        framework: "mastra" as const,
        text: result.text,
        toolCalls: calls,
        ...(typeof inputTokens === "number" && typeof outputTokens === "number"
          ? { usage: { inputTokens, outputTokens } }
          : {}),
      };
    },
  };
}
