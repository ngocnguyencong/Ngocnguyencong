import { generateText, stepCountIs, tool as aiTool } from "ai";

import { executeToolCall, type RecordedToolCall } from "../execution";
import {
  DEFAULT_AGENT_MAX_STEPS,
  type AgentModelSource,
  type AgentRunInput,
  type AgentRunner,
} from "../runtime";

export function createAiSdkRunner(model: AgentModelSource): AgentRunner {
  return {
    framework: "ai-sdk",
    async run(input: AgentRunInput) {
      const calls: RecordedToolCall[] = [];
      const tools = Object.fromEntries(
        input.tools.map((definition) => [
          definition.name,
          aiTool({
            description: definition.description,
            inputSchema: definition.inputSchema,
            execute: async (args) => executeToolCall(definition, args, input.context, calls),
          }),
        ]),
      );

      const result = await generateText({
        model: model.languageModel,
        system: input.instructions,
        prompt: input.prompt,
        tools,
        stopWhen: stepCountIs(input.maxSteps ?? DEFAULT_AGENT_MAX_STEPS),
        ...(input.signal === undefined ? {} : { abortSignal: input.signal }),
      });

      const inputTokens = result.totalUsage.inputTokens;
      const outputTokens = result.totalUsage.outputTokens;
      return {
        framework: "ai-sdk" as const,
        text: result.text,
        toolCalls: calls,
        ...(inputTokens === undefined || outputTokens === undefined
          ? {}
          : { usage: { inputTokens, outputTokens } }),
      };
    },
  };
}
