import { describe, expect, test } from "vitest";

type Price = {
  readonly currency: string;
  readonly effectiveFrom: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly priceId: string;
  readonly provider: string;
};

type ModelCost = {
  readonly cachedInputCostMicrounits: bigint;
  readonly inputCostMicrounits: bigint;
  readonly outputCostMicrounits: bigint;
  readonly priceId: string;
  readonly totalCostMicrounits: bigint;
};

type AiExports = {
  calculateModelCost?: (price: unknown, usage: unknown) => unknown;
  createModelPrice?: (input: unknown) => unknown;
};

async function loadAi(): Promise<AiExports> {
  return (await import("./index").catch(() => ({}))) as AiExports;
}

describe("model pricing", () => {
  test("freezes an effective-dated provider model price", async () => {
    const ai = await loadAi();

    expect(ai.createModelPrice).toBeTypeOf("function");

    const price = ai.createModelPrice!({
      cachedInputMicrounitsPerMillionTokens: 250_001n,
      currency: "USD",
      effectiveFrom: "2026-09-03T00:00:00.000Z",
      inputMicrounitsPerMillionTokens: 1_000_001n,
      model: "gpt-5-mini",
      modelVersion: "2026-08-07",
      outputMicrounitsPerMillionTokens: 500_001n,
      priceId: "openai:gpt-5-mini:2026-08-07:2026-09-03",
      provider: "openai",
    }) as Price;

    expect(price).toMatchObject({
      currency: "USD",
      effectiveFrom: "2026-09-03T00:00:00.000Z",
      model: "gpt-5-mini",
      modelVersion: "2026-08-07",
      priceId: "openai:gpt-5-mini:2026-08-07:2026-09-03",
      provider: "openai",
    });
    expect(Object.isFrozen(price)).toBe(true);
  });

  test("ceil-rounds bigint token costs and keeps the price identity", async () => {
    const ai = await loadAi();

    expect(ai.createModelPrice).toBeTypeOf("function");
    expect(ai.calculateModelCost).toBeTypeOf("function");

    const price = ai.createModelPrice!({
      cachedInputMicrounitsPerMillionTokens: 250_001n,
      currency: "USD",
      effectiveFrom: "2026-09-03T00:00:00.000Z",
      inputMicrounitsPerMillionTokens: 1_000_001n,
      model: "gpt-5-mini",
      modelVersion: "2026-08-07",
      outputMicrounitsPerMillionTokens: 500_001n,
      priceId: "openai:gpt-5-mini:2026-08-07:2026-09-03",
      provider: "openai",
    });

    const cost = ai.calculateModelCost!(price, {
      cachedInputTokens: 3n,
      inputTokens: 1n,
      outputTokens: 2n,
    }) as ModelCost;

    expect(cost).toEqual({
      cachedInputCostMicrounits: 1n,
      inputCostMicrounits: 2n,
      outputCostMicrounits: 2n,
      priceId: "openai:gpt-5-mini:2026-08-07:2026-09-03",
      totalCostMicrounits: 5n,
    });
  });
});
