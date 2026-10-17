import { randomUUID } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { creditBalance, creditTransaction } from "./schema";
import type * as schema from "./schema";

type CreditsDatabase = PostgresJsDatabase<typeof schema>;

/** Row shape — one append-only ledger entry per credit movement. */
export type CreditTransaction = typeof creditTransaction.$inferSelect;

/**
 * Upper bound for a single ledger `amount`. `balance` is int4, so bounding
 * every delta keeps `balance + amount` far below the integer ceiling for any
 * realistic pool; the debit guard additionally never lets the result go
 * negative.
 */
export const MAX_CREDIT_AMOUNT = 1_000_000_000;

/** `kind` vocabulary the schema comment documents for `credit_transaction`. */
export const CREDIT_TRANSACTION_KINDS = [
  "grant",
  "debit",
  "refund",
  "expire",
  "adjustment",
] as const;
export type CreditTransactionKind = (typeof CREDIT_TRANSACTION_KINDS)[number];

const POSITIVE_KINDS: readonly CreditTransactionKind[] = ["grant", "refund"];
const NEGATIVE_KINDS: readonly CreditTransactionKind[] = ["debit", "expire"];

/**
 * Thrown when a debit would drive the workspace balance negative. The guarded
 * UPDATE writes nothing — the transaction rolls back, so neither the balance
 * row nor the ledger row exists afterwards.
 */
export class InsufficientCreditsError extends Error {
  readonly code = "insufficient_credits" as const;
  readonly workspaceId: string;

  constructor(workspaceId: string) {
    super("The workspace does not have enough credits for this transaction.");
    this.name = "InsufficientCreditsError";
    this.workspaceId = workspaceId;
  }
}

export interface AppendCreditTransactionInput {
  readonly workspaceId: string;
  /** Signed delta — grants/refunds positive, debits/expires negative. */
  readonly amount: number;
  readonly kind: CreditTransactionKind;
  readonly reason?: string;
  readonly referenceId?: string;
  readonly actorUserId?: string;
}

export interface CreditsRepository {
  /**
   * Atomically applies one ledger movement inside a single transaction:
   * the `credit_balance` upsert/guarded-update runs first, then the
   * `credit_transaction` row is appended with the resulting `balanceAfter`.
   * A debit that would take the balance negative fails atomically with
   * `InsufficientCreditsError` — the `WHERE balance + amount >= 0` guard
   * holds the row lock while re-checking, so concurrent debits serialize
   * and only the ones that still fit commit.
   */
  appendTransaction(input: AppendCreditTransactionInput): Promise<Readonly<{ balance: number }>>;
  /** Current credit balance — `0` when no `credit_balance` row exists yet. */
  getBalance(workspaceId: string): Promise<number>;
  /** Recent ledger entries for the workspace, newest first. */
  listTransactions(workspaceId: string, limit?: number): Promise<CreditTransaction[]>;
  /** Idempotency lookup for reference-keyed writes (plan grants, replays). */
  hasTransactionWithReference(
    workspaceId: string,
    referenceId: string,
    kind?: CreditTransactionKind,
  ): Promise<boolean>;
}

/**
 * True when a failed write hit the `uq_credit_transaction_reference` unique
 * index — a concurrent writer already recorded this (workspace, kind,
 * reference). Callers treat it as "already applied", not an error.
 */
export function isCreditReferenceConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505" &&
    ((error as { constraint_name?: unknown }).constraint_name ===
      "uq_credit_transaction_reference" ||
      (error as { constraint?: unknown }).constraint === "uq_credit_transaction_reference")
  );
}

export function createDrizzleCreditsRepository(
  database: CreditsDatabase,
  options?: { createId?: () => string },
): CreditsRepository {
  const createId = options?.createId ?? (() => `ctxn_${randomUUID()}`);

  return Object.freeze({
    async appendTransaction(
      input: AppendCreditTransactionInput,
    ): Promise<Readonly<{ balance: number }>> {
      const scope = normalizeAppendInput(input);
      const { amount, workspaceId } = scope;

      return database.transaction(async (transaction) => {
        let balanceAfter: number;
        if (amount >= 0) {
          // Non-negative delta: the insert branch is always safe, so one
          // upsert covers both the missing-row and existing-row cases.
          const rows = await transaction.execute<BalanceRow>(sql`
            INSERT INTO credit_balance (workspace_id, balance)
            VALUES (${workspaceId}, ${amount})
            ON CONFLICT (workspace_id) DO UPDATE
              SET balance = credit_balance.balance + ${amount},
                  updated_at = now()
            RETURNING balance
          `);
          const updated = rows[0];
          if (updated === undefined) {
            throw new Error("The credit balance write returned no row.");
          }
          balanceAfter = updated.balance;
        } else {
          // Negative delta: the guard lives in the statement itself, not a
          // pre-read. The conditional UPDATE takes the workspace's balance
          // row lock, then evaluates `balance + amount >= 0` on the locked
          // row — concurrent debits serialize on that lock. A missing row
          // or an insufficient balance updates zero rows and never writes.
          const rows = await transaction.execute<BalanceRow>(sql`
            UPDATE credit_balance
              SET balance = credit_balance.balance + ${amount},
                  updated_at = now()
            WHERE credit_balance.workspace_id = ${workspaceId}
              AND credit_balance.balance + ${amount} >= 0
            RETURNING balance
          `);
          const updated = rows[0];
          if (updated === undefined) {
            throw new InsufficientCreditsError(workspaceId);
          }
          balanceAfter = updated.balance;
        }

        await transaction.insert(creditTransaction).values({
          actorUserId: scope.actorUserId ?? null,
          amount,
          balanceAfter,
          id: createId(),
          kind: scope.kind,
          reason: scope.reason ?? null,
          referenceId: scope.referenceId ?? null,
          workspaceId,
        });

        return { balance: balanceAfter };
      });
    },

    async getBalance(workspaceId: string): Promise<number> {
      const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
      const [row] = await database
        .select({ balance: creditBalance.balance })
        .from(creditBalance)
        .where(eq(creditBalance.workspaceId, normalizedWorkspaceId))
        .limit(1);
      return row?.balance ?? 0;
    },

    async listTransactions(workspaceId: string, limit = 50): Promise<CreditTransaction[]> {
      const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
      const normalizedLimit = normalizeLimit(limit);
      return database
        .select()
        .from(creditTransaction)
        .where(eq(creditTransaction.workspaceId, normalizedWorkspaceId))
        .orderBy(desc(creditTransaction.createdAt), desc(creditTransaction.id))
        .limit(normalizedLimit);
    },

    async hasTransactionWithReference(
      workspaceId: string,
      referenceId: string,
      kind?: CreditTransactionKind,
    ): Promise<boolean> {
      const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
      const normalizedReferenceId = normalizeReferenceId(referenceId);
      const conditions = [
        eq(creditTransaction.workspaceId, normalizedWorkspaceId),
        eq(creditTransaction.referenceId, normalizedReferenceId),
      ];
      if (kind !== undefined) {
        if (!CREDIT_TRANSACTION_KINDS.includes(kind)) {
          throw new Error("A valid credit transaction kind is required.");
        }
        conditions.push(eq(creditTransaction.kind, kind));
      }
      const [row] = await database
        .select({ id: creditTransaction.id })
        .from(creditTransaction)
        .where(and(...conditions))
        .limit(1);
      return row !== undefined;
    },
  });
}

type BalanceRow = Readonly<{ balance: number }>;

function requireInput(input: unknown): asserts input is Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw new Error("A valid credit transaction input is required.");
  }
}

type NormalizedAppendInput = Readonly<{
  actorUserId?: string;
  amount: number;
  kind: CreditTransactionKind;
  reason?: string;
  referenceId?: string;
  workspaceId: string;
}>;

function normalizeAppendInput(input: AppendCreditTransactionInput): NormalizedAppendInput {
  requireInput(input);
  const workspaceId = normalizeWorkspaceId(input.workspaceId);

  const amount = input.amount;
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_CREDIT_AMOUNT) {
    throw new Error("A valid credit amount is required.");
  }

  const kind = input.kind;
  if (!CREDIT_TRANSACTION_KINDS.includes(kind)) {
    throw new Error("A valid credit transaction kind is required.");
  }
  if (POSITIVE_KINDS.includes(kind) && amount <= 0) {
    throw new Error(`A ${kind} transaction requires a positive amount.`);
  }
  if (NEGATIVE_KINDS.includes(kind) && amount >= 0) {
    throw new Error(`A ${kind} transaction requires a negative amount.`);
  }

  const reason = normalizeOptionalText(input.reason, 255, "reason");
  const referenceId =
    input.referenceId === undefined ? undefined : normalizeReferenceId(input.referenceId);
  const actorUserId = normalizeOptionalText(input.actorUserId, 255, "actor user");

  return Object.freeze({
    ...(actorUserId === undefined ? {} : { actorUserId }),
    amount,
    kind,
    ...(reason === undefined ? {} : { reason }),
    ...(referenceId === undefined ? {} : { referenceId }),
    workspaceId,
  });
}

function normalizeWorkspaceId(workspaceId: string): string {
  if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
    throw new Error("A valid workspace is required.");
  }
  return workspaceId;
}

function normalizeReferenceId(referenceId: string): string {
  if (
    typeof referenceId !== "string" ||
    referenceId.trim().length === 0 ||
    referenceId.length > 128
  ) {
    throw new Error("A valid credit transaction reference is required.");
  }
  return referenceId;
}

function normalizeOptionalText(
  value: string | undefined,
  maxLength: number,
  label: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`A valid credit transaction ${label} is required.`);
  }
  return value;
}

function normalizeLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("A valid transaction limit is required.");
  }
  return limit;
}
