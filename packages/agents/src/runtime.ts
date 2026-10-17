import type { LanguageModel } from "ai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import type { RecordedToolCall } from "./execution.js";
import type { ToolContext, ToolDefinition } from "./tools.js";

export const AGENT_FRAMEWORKS = ["ai-sdk", "mastra", "langgraph", "openai-agents"] as const;
export type AgentFramework = (typeof AGENT_FRAMEWORKS)[number];

export interface AgentRunInput {
  readonly instructions: string;
  readonly prompt: string;
  readonly tools: readonly ToolDefinition[];
  readonly context: ToolContext;
  readonly maxSteps?: number;
  readonly signal?: AbortSignal;
}

export interface AgentRunResult {
  readonly framework: AgentFramework;
  readonly text: string;
  readonly toolCalls: readonly RecordedToolCall[];
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
}

export interface AgentRunner {
  readonly framework: AgentFramework;
  run(input: AgentRunInput): Promise<AgentRunResult>;
}

export const DEFAULT_AGENT_MAX_STEPS = 8;

/**
 * Framework-neutral model input: the AI SDK language model covers the ai-sdk,
 * mastra, and openai-agents adapters; langgraph needs a LangChain chat model
 * supplied by the composition layer when that framework is selected.
 */
export interface AgentModelSource {
  readonly languageModel: LanguageModel;
  readonly langChainModel?: () => Promise<BaseChatModel>;
}

/**
 * Lazily loads the selected adapter so unused framework SDKs never enter the
 * module graph (important for edge/serverless cold starts and bundle size).
 */
export async function createAgentRunner(
  framework: AgentFramework,
  model: AgentModelSource,
): Promise<AgentRunner> {
  switch (framework) {
    case "ai-sdk": {
      const { createAiSdkRunner } = await import("./adapters/ai-sdk");
      return createAiSdkRunner(model);
    }
    case "mastra": {
      const { createMastraRunner } = await import("./adapters/mastra");
      return createMastraRunner(model);
    }
    case "langgraph": {
      const { createLangGraphRunner } = await import("./adapters/langgraph");
      return createLangGraphRunner(model);
    }
    case "openai-agents": {
      const { createOpenAiAgentsRunner } = await import("./adapters/openai-agents");
      return createOpenAiAgentsRunner(model);
    }
  }
}
