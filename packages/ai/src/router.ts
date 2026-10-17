import {
  isRetryableAiError,
  throwIfAborted,
  type AiCompletionRequest,
  type AiExecutionResult,
  type AiProviderAttemptHooks,
  type AiProvider,
  type AiUsageAuditRecord,
  type AiUsageAuditRecorder,
  type AvailableModel,
  type ModelCapabilities,
  type ModelRequirements,
  type MonotonicClock,
  type WorkspaceBudget,
} from "./contracts";
import { calculateModelCost } from "./pricing";

export interface ModelRouterConfig {
  readonly clock?: MonotonicClock;
  readonly models: readonly AvailableModel[];
  readonly providers: readonly AiProvider[];
  readonly recorder?: AiUsageAuditRecorder;
}

const defaultClock: MonotonicClock = Object.freeze({
  now: () => performance.now(),
});

const noOpRecorder: AiUsageAuditRecorder = Object.freeze({
  record: () => undefined,
});

export class NoEligibleModelError extends Error {
  constructor(requirements: ModelRequirements) {
    super(`No configured model satisfies requirements: ${JSON.stringify(requirements)}`);
    this.name = "NoEligibleModelError";
  }
}

export class WorkspaceBudgetExceededError extends Error {
  constructor(workspaceId: string) {
    super(`No eligible model fits workspace budget: ${workspaceId}`);
    this.name = "WorkspaceBudgetExceededError";
  }
}

export class ModelRouter {
  private readonly clock: MonotonicClock;
  private readonly models: readonly AvailableModel[];
  private readonly providers: ReadonlyMap<string, AiProvider>;
  private readonly recorder: AiUsageAuditRecorder;

  constructor(config: ModelRouterConfig) {
    this.clock = config.clock ?? defaultClock;
    this.models = Object.freeze([...config.models]);
    this.providers = new Map(config.providers.map((provider) => [provider.provider, provider]));
    this.recorder = config.recorder ?? noOpRecorder;
  }

  async complete(
    request: AiCompletionRequest,
    hooks: AiProviderAttemptHooks = {},
  ): Promise<AiExecutionResult> {
    throwIfAborted(request.signal);
    const capableCandidates = this.models.filter((model) =>
      supportsRequirements(model.capabilities, request.requirements),
    );

    if (capableCandidates.length === 0) {
      throw new NoEligibleModelError(request.requirements);
    }

    const budgetCandidates = capableCandidates.filter((model) =>
      fitsBudget(model, request.workspace.budget, request.estimatedUsage),
    );

    if (budgetCandidates.length === 0) {
      throw new WorkspaceBudgetExceededError(request.workspace.workspaceId);
    }

    const rankedCandidates = [...budgetCandidates].sort((left, right) => {
      const rankDifference = left.ranking[request.alias] - right.ranking[request.alias];

      return rankDifference === 0 ? left.id.localeCompare(right.id) : rankDifference;
    });
    const attemptedModelIds: string[] = [];

    for (const candidate of rankedCandidates) {
      throwIfAborted(request.signal);
      const provider = this.providers.get(candidate.provider);

      if (provider === undefined) {
        throw new Error(`No provider configured for model provider: ${candidate.provider}`);
      }

      attemptedModelIds.push(candidate.id);
      await hooks.beforeProviderAttempt?.({
        attemptNumber: attemptedModelIds.length,
        ...(request.estimatedUsage === undefined ? {} : { estimatedUsage: request.estimatedUsage }),
        model: candidate,
        workspaceId: request.workspace.workspaceId,
      });
      throwIfAborted(request.signal);
      const startedAt = this.clock.now();

      try {
        const completion = await provider.complete({
          input: request.input,
          model: candidate,
          ...(request.signal === undefined ? {} : { signal: request.signal }),
          workspace: request.workspace,
        });
        const cost = calculateModelCost(candidate.price, completion.usage);

        await this.recordAttempt({
          latencyMs: this.clock.now() - startedAt,
          model: candidate.model,
          modelVersion: candidate.modelVersion,
          priceId: candidate.price.priceId,
          provider: candidate.provider,
          status: "succeeded",
          usage: Object.freeze({
            ...(completion.usage.cachedInputTokens === undefined
              ? {}
              : { cachedInputTokens: completion.usage.cachedInputTokens }),
            cachedInputCostMicrounits: cost.cachedInputCostMicrounits,
            inputCostMicrounits: cost.inputCostMicrounits,
            inputTokens: completion.usage.inputTokens,
            outputCostMicrounits: cost.outputCostMicrounits,
            outputTokens: completion.usage.outputTokens,
            totalCostMicrounits: cost.totalCostMicrounits,
          }),
          workspaceId: request.workspace.workspaceId,
        });

        return Object.freeze({
          attemptedModelIds: Object.freeze([...attemptedModelIds]),
          keyMode: request.workspace.keyMode,
          model: candidate,
          text: completion.text,
          usage: Object.freeze({
            ...completion.usage,
            costMicrounits: cost.totalCostMicrounits,
            priceId: cost.priceId,
          }),
          workspaceId: request.workspace.workspaceId,
        });
      } catch (error) {
        await this.recordAttempt({
          latencyMs: this.clock.now() - startedAt,
          model: candidate.model,
          modelVersion: candidate.modelVersion,
          priceId: candidate.price.priceId,
          provider: candidate.provider,
          status: "failed",
          workspaceId: request.workspace.workspaceId,
        });

        if (request.signal?.aborted || !isRetryableAiError(error)) {
          throw error;
        }

        if (candidate === rankedCandidates.at(-1)) {
          throw error;
        }
      }
    }

    throw new Error("No model completion was attempted");
  }

  private async recordAttempt(record: AiUsageAuditRecord): Promise<void> {
    try {
      await this.recorder.record(Object.freeze({ ...record }));
    } catch {
      // Audit persistence is intentionally isolated from model selection and errors.
    }
  }
}

function supportsRequirements(
  capabilities: ModelCapabilities,
  requirements: ModelRequirements,
): boolean {
  return (
    capabilities.maxContext >= (requirements.minContext ?? 0) &&
    (!requirements.vision || capabilities.vision) &&
    (!requirements.tools || capabilities.tools) &&
    (!requirements.structuredOutput || capabilities.structuredOutput)
  );
}

function fitsBudget(
  model: AvailableModel,
  budget: WorkspaceBudget | null,
  estimatedUsage: AiCompletionRequest["estimatedUsage"],
): boolean {
  if (budget === null || estimatedUsage === undefined) {
    return true;
  }

  const projectedCost = calculateModelCost(model.price, estimatedUsage);

  return budget.spentMicrounits + projectedCost.totalCostMicrounits <= budget.limitMicrounits;
}
