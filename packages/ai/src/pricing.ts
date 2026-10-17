import type { TokenUsage } from "./contracts";

const TOKENS_PER_RATE_UNIT = 1_000_000n;

export interface ModelPrice {
  readonly cachedInputMicrounitsPerMillionTokens: bigint;
  readonly currency: string;
  readonly effectiveFrom: string;
  readonly inputMicrounitsPerMillionTokens: bigint;
  readonly model: string;
  readonly modelVersion: string;
  readonly outputMicrounitsPerMillionTokens: bigint;
  readonly priceId: string;
  readonly provider: string;
}

export interface ModelCost {
  readonly cachedInputCostMicrounits: bigint;
  readonly inputCostMicrounits: bigint;
  readonly outputCostMicrounits: bigint;
  readonly priceId: string;
  readonly totalCostMicrounits: bigint;
}

function assertNonEmpty(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${name} must not be empty`);
  }
}

function assertNonNegative(value: bigint, name: string): void {
  if (value < 0n) {
    throw new Error(`${name} must be non-negative`);
  }
}

function divideAndCeil(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

export function createModelPrice(input: ModelPrice): ModelPrice {
  assertNonEmpty(input.priceId, "priceId");
  assertNonEmpty(input.provider, "provider");
  assertNonEmpty(input.model, "model");
  assertNonEmpty(input.modelVersion, "modelVersion");
  assertNonEmpty(input.currency, "currency");
  assertNonEmpty(input.effectiveFrom, "effectiveFrom");
  assertNonNegative(
    input.cachedInputMicrounitsPerMillionTokens,
    "cachedInputMicrounitsPerMillionTokens",
  );
  assertNonNegative(input.inputMicrounitsPerMillionTokens, "inputMicrounitsPerMillionTokens");
  assertNonNegative(input.outputMicrounitsPerMillionTokens, "outputMicrounitsPerMillionTokens");

  return Object.freeze({ ...input });
}

export function calculateModelCost(price: ModelPrice, usage: TokenUsage): ModelCost {
  assertNonNegative(usage.inputTokens, "inputTokens");
  assertNonNegative(usage.outputTokens, "outputTokens");

  const inputCostMicrounits = divideAndCeil(
    usage.inputTokens * price.inputMicrounitsPerMillionTokens,
    TOKENS_PER_RATE_UNIT,
  );
  const cachedInputCostMicrounits = divideAndCeil(
    (usage.cachedInputTokens ?? 0n) * price.cachedInputMicrounitsPerMillionTokens,
    TOKENS_PER_RATE_UNIT,
  );
  const outputCostMicrounits = divideAndCeil(
    usage.outputTokens * price.outputMicrounitsPerMillionTokens,
    TOKENS_PER_RATE_UNIT,
  );

  return Object.freeze({
    cachedInputCostMicrounits,
    inputCostMicrounits,
    outputCostMicrounits,
    priceId: price.priceId,
    totalCostMicrounits: inputCostMicrounits + cachedInputCostMicrounits + outputCostMicrounits,
  });
}
