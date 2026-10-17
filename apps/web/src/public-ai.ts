import {
  calculateModelCost,
  completeStructured,
  type AiCompletionRequest,
  type AiExecutionResult,
  type AiProviderAttemptHooks,
  type StructuredCompletion,
  type StructuredCompletionRequest,
  type StructuredRouter,
  type WorkspaceAiContext,
} from "@supastack/ai";

export class PublicAiBudgetExceededError extends Error {
  constructor() {
    super("The public AI daily budget is exhausted.");
    this.name = "PublicAiBudgetExceededError";
  }
}

export interface PublicAiDeps {
  /** Platform daily cap; 0n disables public AI entirely. */
  readonly dailyBudgetMicrounits: bigint;
  readonly now: () => Date;
  readonly release: (input: Readonly<{ amount: bigint; day: string }>) => Promise<void>;
  readonly reserve: (input: Readonly<{ amount: bigint; day: string }>) => Promise<boolean>;
  readonly router: StructuredRouter;
  readonly settle: (
    input: Readonly<{ actual: bigint; day: string; reserved: bigint }>,
  ) => Promise<void>;
}

/**
 * Public/anonymous AI boundary. Callers MUST gate with captcha and a shared
 * rate limiter before reaching this runner. Requests run against the
 * platform-scoped workspace (`platform:public`) and every provider attempt
 * reserves `calculateModelCost(model.price, estimatedUsage)` microunits
 * against the UTC-day `platform_ai_spend` row — public AI never writes
 * `ai_usage` (that table is workspace-FK-scoped); spend lives in
 * `platform_ai_spend` and usage goes to observability.
 */
export function createPublicAiRunner(deps: PublicAiDeps) {
  const workspace: WorkspaceAiContext = Object.freeze({
    budget: null,
    keyMode: "platform",
    workspaceId: "platform:public",
  });

  function utcDay(now: Date): string {
    return now.toISOString().slice(0, 10);
  }

  function requireBudget(): void {
    if (deps.dailyBudgetMicrounits === 0n) {
      throw new PublicAiBudgetExceededError();
    }
  }

  function requireEstimatedUsage(
    request: Readonly<{ estimatedUsage?: AiCompletionRequest["estimatedUsage"] }>,
  ): void {
    if (request.estimatedUsage === undefined) {
      throw new TypeError("Public AI requests require estimatedUsage for budget reservation.");
    }
  }

  /**
   * Reserves per provider attempt (a retry means the previous attempt failed,
   * so its pending reservation is released first), then settles to the
   * completion's actual cost or releases on failure.
   */
  function budgetedHooks(day: string): {
    readonly hooks: AiProviderAttemptHooks;
    readonly releasePending: () => Promise<void>;
    readonly settlePending: (actual: bigint) => Promise<void>;
  } {
    let pending: bigint | null = null;
    const releasePending = async () => {
      const reserved = pending;
      pending = null;
      if (reserved !== null) {
        await deps.release({ amount: reserved, day });
      }
    };
    return Object.freeze({
      hooks: {
        beforeProviderAttempt: async (attempt) => {
          await releasePending();
          const usage = attempt.estimatedUsage;
          if (usage === undefined) {
            throw new TypeError(
              "Public AI requests require estimatedUsage for budget reservation.",
            );
          }
          const amount = calculateModelCost(attempt.model.price, usage).totalCostMicrounits;
          const reserved = await deps.reserve({ amount, day });
          if (!reserved) {
            throw new PublicAiBudgetExceededError();
          }
          pending = amount;
        },
      },
      releasePending,
      settlePending: async (actual) => {
        const reserved = pending;
        pending = null;
        if (reserved !== null) {
          await deps.settle({ actual, day, reserved });
        }
      },
    });
  }

  async function completeBudgeted(
    request: Omit<AiCompletionRequest, "workspace">,
  ): Promise<AiExecutionResult> {
    requireBudget();
    requireEstimatedUsage(request);
    const lifecycle = budgetedHooks(utcDay(deps.now()));
    try {
      const result = await deps.router.complete({ ...request, workspace }, lifecycle.hooks);
      await lifecycle.settlePending(result.usage.costMicrounits);
      return result;
    } catch (error) {
      try {
        await lifecycle.releasePending();
      } catch {
        // Budget release must not mask the provider error.
      }
      throw error;
    }
  }

  return Object.freeze({
    complete: completeBudgeted,
    async completeStructured<T>(
      request: Omit<StructuredCompletionRequest<T>, "workspace">,
    ): Promise<StructuredCompletion<T>> {
      requireBudget();
      requireEstimatedUsage(request);
      // Schema rejection still incurs provider cost. Settle each response before
      // validation, so a repair must reserve against the remaining daily budget.
      return completeStructured({ complete: completeBudgeted }, { ...request, workspace });
    },
  });
}
