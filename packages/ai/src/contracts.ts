import type { ModelPrice } from "./pricing";

export type ModelAlias = "fast" | "smart" | "cheap";

export type WorkspaceKeyMode = "platform" | "byok";

export interface ModelRequirements {
  readonly minContext?: number;
  readonly structuredOutput?: boolean;
  readonly tools?: boolean;
  readonly vision?: boolean;
}

export interface ModelCapabilities {
  readonly maxContext: number;
  readonly structuredOutput: boolean;
  readonly tools: boolean;
  readonly vision: boolean;
}

export interface ModelRanking {
  readonly cheap: number;
  readonly fast: number;
  readonly smart: number;
}

export interface ModelIdentity {
  readonly id: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly provider: string;
}

export interface AvailableModel extends ModelIdentity {
  readonly capabilities: ModelCapabilities;
  readonly price: ModelPrice;
  readonly ranking: ModelRanking;
}

export interface TokenUsage {
  readonly cachedInputTokens?: bigint;
  readonly inputTokens: bigint;
  readonly outputTokens: bigint;
}

export interface WorkspaceBudget {
  readonly limitMicrounits: bigint;
  readonly spentMicrounits: bigint;
}

export interface WorkspaceAiContext {
  readonly budget: WorkspaceBudget | null;
  readonly keyMode: WorkspaceKeyMode;
  readonly workspaceId: string;
}

export interface ProviderCompletionRequest {
  readonly input: unknown;
  readonly model: ModelIdentity;
  readonly signal?: AbortSignal;
  readonly workspace: WorkspaceAiContext;
}

export interface ProviderCompletion {
  readonly text: string;
  readonly usage: TokenUsage;
}

export interface AiProvider {
  readonly provider: string;
  complete(request: ProviderCompletionRequest): Promise<ProviderCompletion>;
}

export interface AiRequest {
  readonly alias: ModelAlias;
  readonly input: unknown;
  readonly requirements: ModelRequirements;
  readonly signal?: AbortSignal;
  readonly workspaceId: string;
}

export interface AiCompletionRequest extends Omit<AiRequest, "workspaceId"> {
  readonly estimatedUsage?: TokenUsage;
  readonly workspace: WorkspaceAiContext;
}

/** Safe identity supplied to the owning runtime immediately before an SDK call. */
export interface AiProviderAttempt {
  readonly attemptNumber: number;
  readonly estimatedUsage?: TokenUsage;
  readonly model: AvailableModel;
  readonly workspaceId: string;
}

/** Runtime-only hook; provider-neutral routing never persists or authorizes itself. */
export interface AiProviderAttemptHooks {
  beforeProviderAttempt?(attempt: AiProviderAttempt): void | Promise<void>;
}

export interface AiUsageResult extends TokenUsage {
  readonly costMicrounits: bigint;
  readonly priceId: string;
}

export interface AiUsageAuditUsage extends TokenUsage {
  readonly cachedInputCostMicrounits: bigint;
  readonly inputCostMicrounits: bigint;
  readonly outputCostMicrounits: bigint;
  readonly totalCostMicrounits: bigint;
}

export interface AiUsageAuditRecord {
  readonly latencyMs: number;
  readonly model: string;
  readonly modelVersion: string;
  readonly priceId: string;
  readonly provider: string;
  readonly status: "succeeded" | "failed";
  readonly usage?: AiUsageAuditUsage;
  readonly workspaceId: string;
}

export interface AiUsageAuditRecorder {
  record(record: AiUsageAuditRecord): void | Promise<void>;
}

export interface MonotonicClock {
  now(): number;
}

export interface AiExecutionResult {
  readonly attemptedModelIds: readonly string[];
  readonly keyMode: WorkspaceKeyMode;
  readonly model: ModelIdentity;
  readonly text: string;
  readonly usage: AiUsageResult;
  readonly workspaceId: string;
}

export class AiProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "AiProviderError";
    this.retryable = retryable;
  }
}

export function isRetryableAiError(error: unknown): error is {
  readonly retryable: true;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "retryable" in error &&
    (error as { readonly retryable?: unknown }).retryable === true
  );
}

/** Throws the platform AbortError or the signal's reason when work was cancelled. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return;

  if (signal.reason instanceof Error) throw signal.reason;

  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  throw error;
}
