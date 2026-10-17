import "server-only";

import {
  createDrizzleCreditsRepository,
  isCreditReferenceConflict,
  type CreditTransaction,
  type CreditsRepository,
} from "@supastack/db";

import { database } from "./auth-runtime";

export type { CreditTransaction } from "@supastack/db";

/**
 * Server-side wrappers around the workspace credit ledger — thin accessors
 * over the app's `database`, the same shape `usage-quota.ts` uses for the
 * `usage_counter` repository. Credits are the prepaid pool that keeps metered
 * actions running after a plan's per-period `usageLimits` quota is exhausted.
 */

let repository: CreditsRepository | null = null;
function creditsRepository(): CreditsRepository {
  repository ??= createDrizzleCreditsRepository(database);
  return repository;
}

/** Current prepaid credit balance for the workspace — `0` when no row exists. */
export async function getWorkspaceCredits(workspaceId: string): Promise<number> {
  return creditsRepository().getBalance(workspaceId);
}

/** Recent ledger entries, newest first (default 50). */
export async function listWorkspaceCreditTransactions(
  workspaceId: string,
  limit?: number,
): Promise<CreditTransaction[]> {
  return creditsRepository().listTransactions(workspaceId, limit);
}

/**
 * Adds credits to the workspace pool. When `referenceId` is supplied the grant
 * is idempotent: an existing ledger row with the same reference skips the
 * write and reports `granted: false` (webhook replays, retried activations).
 */
export async function grantWorkspaceCredits(input: {
  readonly workspaceId: string;
  readonly amount: number;
  readonly reason?: string;
  readonly referenceId?: string;
  readonly actorUserId?: string;
}): Promise<Readonly<{ balance: number; granted: boolean }>> {
  const repository = creditsRepository();
  if (
    input.referenceId !== undefined &&
    (await repository.hasTransactionWithReference(input.workspaceId, input.referenceId, "grant"))
  ) {
    return { balance: await repository.getBalance(input.workspaceId), granted: false };
  }
  try {
    const { balance } = await repository.appendTransaction({
      ...(input.actorUserId === undefined ? {} : { actorUserId: input.actorUserId }),
      amount: input.amount,
      kind: "grant",
      ...(input.reason === undefined ? {} : { reason: input.reason }),
      ...(input.referenceId === undefined ? {} : { referenceId: input.referenceId }),
      workspaceId: input.workspaceId,
    });
    return { balance, granted: true };
  } catch (error) {
    // The fast-path check above races a concurrent writer; the unique index
    // on (workspace, kind, reference) is the real guard — its violation means
    // the grant already landed, so report the idempotent result.
    if (input.referenceId !== undefined && isCreditReferenceConflict(error)) {
      return { balance: await repository.getBalance(input.workspaceId), granted: false };
    }
    throw error;
  }
}

/**
 * Spends `amount` credits (a positive number here — the ledger stores it
 * negated). Throws `InsufficientCreditsError` when the balance cannot cover
 * the debit; nothing is written in that case.
 */
export async function debitWorkspaceCredits(input: {
  readonly workspaceId: string;
  readonly amount: number;
  readonly reason?: string;
  readonly referenceId?: string;
}): Promise<Readonly<{ balance: number }>> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("A positive integer credit amount is required.");
  }
  return creditsRepository().appendTransaction({
    amount: -input.amount,
    kind: "debit",
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    ...(input.referenceId === undefined ? {} : { referenceId: input.referenceId }),
    workspaceId: input.workspaceId,
  });
}
