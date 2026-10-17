import { Agent, run, setTracingDisabled, tool as oaTool, type Model } from "@openai/agents";
import { aisdk } from "@openai/agents-extensions/ai-sdk";

type LanguageModelCompatible = Parameters<typeof aisdk>[0];

import { executeToolCall, type RecordedToolCall } from "../execution";
import {
  DEFAULT_AGENT_MAX_STEPS,
  type AgentModelSource,
  type AgentRunInput,
  type AgentRunner,
} from "../runtime";

// The Agents SDK exports OTLP traces by default; this runner must never
// phone home to OpenAI when a third-party AI SDK model is attached.
setTracingDisabled(true);

export function createOpenAiAgentsRunner(model: AgentModelSource): AgentRunner {
  return {
    framework: "openai-agents",
    async run(input: AgentRunInput) {
      const calls: RecordedToolCall[] = [];
      const agent = new Agent({
        name: "supastack-agent",
        instructions: input.instructions,
        // The extension's compat type is structural; the Agent field type has
        // an internal exactOptionalPropertyTypes variance, hence the cast.
        model: aisdk(model.languageModel as LanguageModelCompatible) as unknown as Model,
        tools: input.tools.map((definition) =>
          oaTool({
            name: definition.name,
            description: definition.description,
            parameters: definition.inputSchema,
            execute: async (args) => executeToolCall(definition, args, input.context, calls),
          }),
        ),
      });

      const result = await run(agent, input.prompt, {
        maxTurns: input.maxSteps ?? DEFAULT_AGENT_MAX_STEPS,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });

      const usage = result.state?.usage;
      return {
        framework: "openai-agents" as const,
        text: typeof result.finalOutput === "string" ? result.finalOutput : "",
        toolCalls: calls,
        ...(usage === undefined
          ? {}
          : { usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } }),
      };
    },
  };
}
