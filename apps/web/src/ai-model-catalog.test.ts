import {
  AiProviderError,
  FakeAiProvider,
  createModelPrice,
  type AvailableModel,
} from "@supastack/ai";
import { parsePublicConfig, parseServerConfig } from "@supastack/config";
import { describe, expect, it, vi } from "vitest";

import { createRuntimeModelRouter, toAvailableModels } from "./ai-model-catalog.js";

describe("AI model catalog", () => {
  it("keeps fallback inside configured capable models and preserves BYOK and authorization", async () => {
    const policy = parseServerConfig({
      AI_MODEL_POLICY: '{"fast":["missing","no-vision","first","second"],"smart":[],"cheap":[]}',
    }).aiRouting;
    const models: AvailableModel[] = ["no-vision", "first", "second", "unlisted"].map((id) => ({
      id,
      model: id,
      modelVersion: "1",
      provider: "fake",
      capabilities: {
        maxContext: 10000,
        vision: id !== "no-vision",
        tools: true,
        structuredOutput: true,
      },
      ranking: { fast: 0, smart: 0, cheap: 0 },
      price: createModelPrice({
        priceId: `price_${id}`,
        model: id,
        modelVersion: "1",
        provider: "fake",
        currency: "USD",
        effectiveFrom: "2026-09-01",
        inputMicrounitsPerMillionTokens: 1n,
        outputMicrounitsPerMillionTokens: 1n,
        cachedInputMicrounitsPerMillionTokens: 0n,
      }),
    }));
    const provider = new FakeAiProvider("fake", [new AiProviderError("retry", true)]);
    const hook = vi.fn(async () => undefined);
    const router = createRuntimeModelRouter({
      aliasPolicy: policy,
      provider,
      readModels: async () => models,
    });
    const request = {
      alias: "fast" as const,
      input: "test",
      requirements: { vision: true },
      workspace: { workspaceId: "w", keyMode: "byok" as const, budget: null },
    };
    const result = await router.complete(request, { beforeProviderAttempt: hook });
    expect(result.attemptedModelIds).toEqual(["first", "second"]);
    expect(result.keyMode).toBe("byok");
    expect(result.usage.priceId).toBe("price_second");
    expect(hook).toHaveBeenCalledTimes(2);
    const failed = new FakeAiProvider("fake", [
      new AiProviderError("retry", true),
      new AiProviderError("exhausted", true),
    ]);
    await expect(
      createRuntimeModelRouter({
        aliasPolicy: policy,
        provider: failed,
        readModels: async () => models,
      }).complete(request),
    ).rejects.toThrow("exhausted");
    expect(failed.requests.map((entry) => entry.model.id)).toEqual(["first", "second"]);
    const denied = new FakeAiProvider("fake");
    await expect(
      createRuntimeModelRouter({
        aliasPolicy: policy,
        provider: denied,
        readModels: async () => models,
      }).complete(request, {
        beforeProviderAttempt: () => {
          throw new Error("denied");
        },
      }),
    ).rejects.toThrow("denied");
    expect(denied.requests).toHaveLength(0);
  });
  it("configures independent alias order and disables an alias without provider calls", async () => {
    const config = parseServerConfig({
      AI_MODEL_POLICY: JSON.stringify({
        fast: ["small", "large"],
        smart: ["large", "small"],
        cheap: [],
      }),
    });
    const record = {
      cachedInputMicrounitsPerMillion: 0n,
      contextWindow: 128_000,
      currency: "USD",
      effectiveFrom: new Date("2026-09-01"),
      effectiveTo: null,
      inputMicrounitsPerMillion: 1000n,
      isEnabled: true,
      modelVersion: "1",
      outputMicrounitsPerMillion: 2000n,
      provider: "fake",
      supportsStructuredOutput: true,
      supportsTools: true,
      supportsVision: false,
    };
    const models = toAvailableModels({
      now: new Date("2026-09-05"),
      provider: "fake",
      records: ["large", "small", "unlisted"].map((id) => ({
        ...record,
        model: id,
        modelId: id,
        priceId: `price_${id}`,
      })),
    });
    const provider = new FakeAiProvider("fake");
    const beforeProviderAttempt = vi.fn(async () => undefined);
    const router = createRuntimeModelRouter({
      provider,
      readModels: async () => models,
      aliasPolicy: config.aiRouting,
    });
    const request = {
      input: "test",
      requirements: {},
      workspace: { workspaceId: "w", keyMode: "platform" as const, budget: null },
    };
    expect(
      (await router.complete({ ...request, alias: "fast" }, { beforeProviderAttempt })).model.id,
    ).toBe("small");
    expect((await router.complete({ ...request, alias: "smart" })).usage.priceId).toBe(
      "price_large",
    );
    await expect(
      router.complete({ ...request, alias: "cheap" }, { beforeProviderAttempt }),
    ).rejects.toThrow();
    expect(provider.requests).toHaveLength(2);
    expect(beforeProviderAttempt).toHaveBeenCalledOnce();
    expect(JSON.stringify(parsePublicConfig(config))).not.toContain("aiRouting");
  });

  it.each([
    "broken-json",
    '{"fast":[],"smart":[]}',
    '{"fast":["a","a"],"smart":[],"cheap":[]}',
    '{"fast":[],"smart":[],"cheap":[],"unknown":true}',
  ])("rejects invalid server policy %s", (value) => {
    expect(() => parseServerConfig({ AI_MODEL_POLICY: value })).toThrow();
  });

  it("keeps only active configured-provider models with immutable bigint prices", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const records = [
      {
        cachedInputMicrounitsPerMillion: 100n,
        contextWindow: 128_000,
        currency: "USD",
        effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
        effectiveTo: null,
        inputMicrounitsPerMillion: 1_000n,
        isEnabled: true,
        model: "gpt-test",
        modelId: "model-openai",
        modelVersion: "2026-09-01",
        outputMicrounitsPerMillion: 2_000n,
        priceId: "price-openai-2026-09",
        provider: "openai",
        supportsStructuredOutput: true,
        supportsTools: true,
        supportsVision: false,
      },
      {
        cachedInputMicrounitsPerMillion: 0n,
        contextWindow: 200_000,
        currency: "USD",
        effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
        effectiveTo: null,
        inputMicrounitsPerMillion: 1n,
        isEnabled: true,
        model: "other-provider",
        modelId: "model-other",
        modelVersion: "1",
        outputMicrounitsPerMillion: 1n,
        priceId: "price-other",
        provider: "anthropic",
        supportsStructuredOutput: true,
        supportsTools: true,
        supportsVision: true,
      },
    ];

    expect(
      toAvailableModels({ now, provider: "openai", records, rankings: { "model-openai": 2 } }),
    ).toEqual([
      {
        capabilities: {
          maxContext: 128_000,
          structuredOutput: true,
          tools: true,
          vision: false,
        },
        id: "model-openai",
        model: "gpt-test",
        modelVersion: "2026-09-01",
        price: {
          cachedInputMicrounitsPerMillionTokens: 100n,
          currency: "USD",
          effectiveFrom: "2026-09-01T00:00:00.000Z",
          inputMicrounitsPerMillionTokens: 1_000n,
          model: "gpt-test",
          modelVersion: "2026-09-01",
          outputMicrounitsPerMillionTokens: 2_000n,
          priceId: "price-openai-2026-09",
          provider: "openai",
        },
        provider: "openai",
        ranking: { cheap: 2, fast: 2, smart: 2 },
      },
    ]);
  });

  it("forwards provider-attempt authorization hooks through the production router seam", async () => {
    const beforeProviderAttempt = vi.fn(async () => undefined);
    const provider = new FakeAiProvider("openai");
    const models = toAvailableModels({
      now: new Date("2026-09-04T12:00:00.000Z"),
      provider: "openai",
      records: [
        {
          cachedInputMicrounitsPerMillion: 0n,
          contextWindow: 128_000,
          currency: "USD",
          effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
          effectiveTo: null,
          inputMicrounitsPerMillion: 1_000n,
          isEnabled: true,
          model: "gpt-test",
          modelId: "model-openai",
          modelVersion: "2026-09-01",
          outputMicrounitsPerMillion: 2_000n,
          priceId: "price-openai-2026-09",
          provider: "openai",
          supportsStructuredOutput: true,
          supportsTools: true,
          supportsVision: false,
        },
      ],
    });
    const router = createRuntimeModelRouter({ provider, readModels: async () => models });

    await router.complete(
      {
        alias: "smart",
        estimatedUsage: { inputTokens: 10n, outputTokens: 10n },
        input: { prompt: "test" },
        requirements: {},
        workspace: { budget: null, keyMode: "platform", workspaceId: "workspace-a" },
      },
      { beforeProviderAttempt },
    );

    expect(beforeProviderAttempt).toHaveBeenCalledOnce();
    expect(beforeProviderAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-a" }),
    );
  });
});
