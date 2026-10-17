import {
  ModelRouter,
  createModelPrice,
  type AiProvider,
  type AiProviderAttemptHooks,
  type AvailableModel,
} from "@supastack/ai";
import type { AiRoutingPolicy } from "@supastack/config";

export function createRuntimeModelRouter(
  input: Readonly<{
    aliasPolicy?: AiRoutingPolicy | undefined;
    provider: AiProvider;
    readModels(): Promise<readonly AvailableModel[]>;
  }>,
) {
  return Object.freeze({
    async complete(
      request: Parameters<ModelRouter["complete"]>[0],
      hooks?: AiProviderAttemptHooks,
    ) {
      const available = await input.readModels();
      const order = input.aliasPolicy?.[request.alias];
      const models =
        order === undefined
          ? available
          : available
              .filter((model) => order.includes(model.id))
              .map((model) => ({
                ...model,
                ranking: { ...model.ranking, [request.alias]: order.indexOf(model.id) },
              }));
      return new ModelRouter({ models, providers: [input.provider] }).complete(request, hooks);
    },
  });
}

export type AiModelCatalogRecord = Readonly<{
  cachedInputMicrounitsPerMillion: bigint;
  contextWindow: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  inputMicrounitsPerMillion: bigint;
  isEnabled: boolean;
  model: string;
  modelId: string;
  modelVersion: string;
  outputMicrounitsPerMillion: bigint;
  priceId: string;
  provider: string;
  supportsStructuredOutput: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
}>;

export function toAvailableModels(
  input: Readonly<{
    now: Date;
    provider: string;
    rankings?: Readonly<Record<string, number>>;
    records: readonly AiModelCatalogRecord[];
  }>,
): AvailableModel[] {
  const selected = new Map<string, AiModelCatalogRecord>();
  const candidates = input.records
    .filter(
      (record) =>
        record.isEnabled &&
        record.provider === input.provider &&
        record.effectiveFrom <= input.now &&
        (record.effectiveTo === null || input.now < record.effectiveTo),
    )
    .sort((left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime());

  for (const record of candidates) {
    if (!selected.has(record.modelId)) {
      selected.set(record.modelId, record);
    }
  }

  return [...selected.values()]
    .sort((left, right) => left.modelId.localeCompare(right.modelId))
    .map((record, index) => {
      const rank = input.rankings?.[record.modelId] ?? index + 1;
      if (!Number.isSafeInteger(rank) || rank < 0) {
        throw new Error(`A valid alias rank is required for model ${record.modelId}.`);
      }

      return Object.freeze({
        capabilities: Object.freeze({
          maxContext: record.contextWindow,
          structuredOutput: record.supportsStructuredOutput,
          tools: record.supportsTools,
          vision: record.supportsVision,
        }),
        id: record.modelId,
        model: record.model,
        modelVersion: record.modelVersion,
        price: createModelPrice({
          cachedInputMicrounitsPerMillionTokens: record.cachedInputMicrounitsPerMillion,
          currency: record.currency,
          effectiveFrom: record.effectiveFrom.toISOString(),
          inputMicrounitsPerMillionTokens: record.inputMicrounitsPerMillion,
          model: record.model,
          modelVersion: record.modelVersion,
          outputMicrounitsPerMillionTokens: record.outputMicrounitsPerMillion,
          priceId: record.priceId,
          provider: record.provider,
        }),
        provider: record.provider,
        ranking: Object.freeze({ cheap: rank, fast: rank, smart: rank }),
      });
    });
}
