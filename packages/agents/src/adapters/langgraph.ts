import { HumanMessage, isAIMessage, type BaseMessage } from "@langchain/core/messages";
import { tool as lcTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { executeToolCall, type RecordedToolCall } from "../execution";
import {
  DEFAULT_AGENT_MAX_STEPS,
  type AgentModelSource,
  type AgentRunInput,
  type AgentRunner,
} from "../runtime";

function messageText(message: BaseMessage | undefined): string {
  if (message === undefined) {
    return "";
  }
  const content = message.content;
  if (typeof content === "string") {
    return content;
  }
  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      return part.type === "text" && typeof part.text === "string" ? part.text : "";
    })
    .join("");
}

export function createLangGraphRunner(model: AgentModelSource): AgentRunner {
  return {
    framework: "langgraph",
    async run(input: AgentRunInput) {
      if (model.langChainModel === undefined) {
        throw new Error(
          "The langgraph framework requires a LangChain chat model (AgentModelSource.langChainModel); the configured AI provider does not offer one.",
        );
      }
      const llm = await model.langChainModel();
      const calls: RecordedToolCall[] = [];
      const tools = input.tools.map((definition) =>
        lcTool(
          async (args) => {
            const output = await executeToolCall(definition, args, input.context, calls);
            return typeof output === "string" ? output : JSON.stringify(output ?? null);
          },
          {
            name: definition.name,
            description: definition.description,
            schema: definition.inputSchema,
          },
        ),
      );

      const agent = createReactAgent({ llm, prompt: input.instructions, tools });
      const maxSteps = input.maxSteps ?? DEFAULT_AGENT_MAX_STEPS;
      const state = await agent.invoke(
        { messages: [new HumanMessage(input.prompt)] },
        {
          // Each agent step costs an LLM node plus a tool node; +1 lets the
          // final LLM answer land before the recursion guard trips.
          recursionLimit: maxSteps * 2 + 1,
          ...(input.signal === undefined ? {} : { signal: input.signal }),
        },
      );

      const messages: BaseMessage[] = (state as { messages?: BaseMessage[] }).messages ?? [];
      const lastAi = [...messages].reverse().find((message) => isAIMessage(message));
      return {
        framework: "langgraph" as const,
        text: messageText(lastAi),
        toolCalls: calls,
      };
    },
  };
}
