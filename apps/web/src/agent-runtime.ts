import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { ChatOpenAI } from "@langchain/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import { createAgentRunner, type AgentModelSource, type AgentRunner } from "@supastack/agents";
import type { ServerConfig } from "@supastack/config";

type AiConfig = ServerConfig["providers"]["ai"];

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Framework-neutral model source for agent runs. The AI SDK language model
 * serves the ai-sdk/mastra/openai-agents adapters; `langChainModel` supplies a
 * LangChain chat model for the langgraph adapter (Anthropic has no LangChain
 * companion here, so pick a different framework or provider for that pairing).
 */
export function createLanguageModel(aiConfig: AiConfig, modelId: string): AgentModelSource {
  switch (aiConfig.kind) {
    case "fake":
      throw new Error("Agents need a real AI_PROVIDER to run.");
    case "openai": {
      const openai = createOpenAI({ apiKey: aiConfig.apiKey });
      return {
        languageModel: openai(modelId),
        langChainModel: async () => new ChatOpenAI({ apiKey: aiConfig.apiKey, model: modelId }),
      };
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: aiConfig.apiKey });
      return { languageModel: anthropic(modelId) };
    }
    case "openai-compatible": {
      const compatible = createOpenAI({ apiKey: aiConfig.apiKey, baseURL: aiConfig.baseUrl });
      return {
        languageModel: compatible(modelId),
        langChainModel: async () =>
          new ChatOpenAI({
            apiKey: aiConfig.apiKey,
            configuration: { baseURL: aiConfig.baseUrl },
            model: modelId,
          }),
      };
    }
    case "openrouter": {
      const openrouter = createOpenRouter({
        apiKey: aiConfig.apiKey,
        headers: {
          ...(aiConfig.appName === undefined ? {} : { "X-Title": aiConfig.appName }),
          ...(aiConfig.siteUrl === undefined ? {} : { "HTTP-Referer": aiConfig.siteUrl }),
        },
      });
      return {
        languageModel: openrouter(modelId),
        langChainModel: async () =>
          new ChatOpenAI({
            apiKey: aiConfig.apiKey,
            configuration: {
              baseURL: OPENROUTER_BASE_URL,
              defaultHeaders: {
                ...(aiConfig.appName === undefined ? {} : { "X-Title": aiConfig.appName }),
                ...(aiConfig.siteUrl === undefined ? {} : { "HTTP-Referer": aiConfig.siteUrl }),
              },
            },
            model: modelId,
          }),
      };
    }
  }
}

/**
 * Agent runner bound to the configured framework (AGENT_FRAMEWORK, default
 * ai-sdk). Server-side only — agent runs are deliberately not exposed as a
 * public endpoint because they would bypass the ModelRouter budget.
 */
export async function createWorkspaceAgentRunner(
  serverConfig: ServerConfig,
  modelId: string,
): Promise<AgentRunner> {
  return createAgentRunner(
    serverConfig.agents.framework,
    createLanguageModel(serverConfig.providers.ai, modelId),
  );
}
