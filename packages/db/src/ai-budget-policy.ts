/** A $5 monthly default for platform-funded AI when no workspace limit is set. */
export const DEFAULT_PLATFORM_AI_MONTHLY_BUDGET_MICROUNITS = 5_000_000n;

/** BYOK workspaces may remain unlimited because their provider key bears the cost. */
export function effectiveAiMonthlyBudget(
  policy: Readonly<{ keyMode: string; monthlyBudgetMicrounits: bigint | null }> | undefined,
): bigint | null {
  if (policy?.monthlyBudgetMicrounits !== null && policy?.monthlyBudgetMicrounits !== undefined) {
    return policy.monthlyBudgetMicrounits;
  }
  return policy?.keyMode === "byok" ? null : DEFAULT_PLATFORM_AI_MONTHLY_BUDGET_MICROUNITS;
}
