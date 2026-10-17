import type { MobileApiClient } from "../api/client";

export interface CreditTransaction {
  amount: number;
  balanceAfter: number;
  createdAt: string;
  id: string;
  kind: string;
  reason: string | null;
}

export interface WorkspaceCredits {
  balance: number;
  transactions: CreditTransaction[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toTransaction(value: unknown): CreditTransaction | null {
  if (!isRecord(value)) {
    return null;
  }
  // Rows missing a usable id/kind/date are dropped rather than guessed —
  // defaults would mislabel entries and collide on React keys.
  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.kind !== "string" ||
    value.kind.length === 0 ||
    typeof value.amount !== "number" ||
    typeof value.balanceAfter !== "number" ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    return null;
  }
  return {
    amount: value.amount,
    balanceAfter: value.balanceAfter,
    createdAt: value.createdAt,
    id: value.id,
    kind: value.kind,
    reason: typeof value.reason === "string" ? value.reason : null,
  };
}

/** `GET /api/mobile/credits` — prepaid workspace credit balance + ledger. */
export function createMobileCreditsActions(api: MobileApiClient) {
  return {
    async get(): Promise<WorkspaceCredits> {
      const payload = await api.request<unknown>("/api/mobile/credits");
      if (!isRecord(payload) || typeof payload.balance !== "number") {
        throw new Error("The workspace credits were invalid.");
      }
      const transactions = Array.isArray(payload.transactions)
        ? payload.transactions
            .map(toTransaction)
            .filter((row): row is CreditTransaction => row !== null)
        : [];
      return { balance: payload.balance, transactions };
    },
  };
}
