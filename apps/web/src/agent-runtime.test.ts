import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ServerConfig } from "@supastack/config";

import { createLanguageModel } from "./agent-runtime";

type AiConfig = ServerConfig["providers"]["ai"];

describe("createLanguageModel", () => {
  it("throws for the fake provider", () => {
    expect(() => createLanguageModel({ kind: "fake" }, "model")).toThrow(/real AI_PROVIDER/);
  });

  it("builds an OpenAI model with a LangChain companion", async () => {
    const source = createLanguageModel({ apiKey: "key", kind: "openai" } as AiConfig, "gpt-5-mini");
    expect((source.languageModel as { provider: string }).provider).toContain("openai");
    expect(await source.langChainModel?.()).toBeDefined();
  });

  it("builds an Anthropic model without a LangChain companion", () => {
    const source = createLanguageModel(
      { apiKey: "key", kind: "anthropic" } as AiConfig,
      "claude-sonnet-4-5",
    );
    expect((source.languageModel as { provider: string }).provider).toContain("anthropic");
    expect(source.langChainModel).toBeUndefined();
  });

  it("builds an OpenAI-compatible model against the configured base URL", async () => {
    const source = createLanguageModel(
      {
        apiKey: "key",
        baseUrl: "https://models.example.test/v1",
        kind: "openai-compatible",
      } as AiConfig,
      "custom-model",
    );
    expect((source.languageModel as { provider: string }).provider).toContain("openai");
    expect(await source.langChainModel?.()).toBeDefined();
  });

  it("builds an OpenRouter model with a LangChain companion on the OpenRouter base URL", async () => {
    const source = createLanguageModel(
      {
        apiKey: "key",
        appName: "App",
        kind: "openrouter",
        siteUrl: "https://app.example.test",
      } as AiConfig,
      "anthropic/claude-sonnet-4",
    );
    expect((source.languageModel as { provider: string }).provider).toContain("openrouter");
    const langChainModel = await source.langChainModel?.();
    expect(langChainModel).toBeDefined();
  });
});
