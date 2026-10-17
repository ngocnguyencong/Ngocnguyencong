import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLATFORM_AI_MONTHLY_BUDGET_MICROUNITS,
  effectiveAiMonthlyBudget,
} from "./ai-budget-policy";

describe("effective AI monthly budget", () => {
  it("uses a finite default for absent and null platform policies", () => {
    expect(DEFAULT_PLATFORM_AI_MONTHLY_BUDGET_MICROUNITS).toBe(5_000_000n);
    expect(effectiveAiMonthlyBudget(undefined)).toBe(5_000_000n);
    expect(effectiveAiMonthlyBudget({ keyMode: "platform", monthlyBudgetMicrounits: null })).toBe(
      5_000_000n,
    );
  });

  it("preserves explicit finite budgets and BYOK unlimited semantics", () => {
    expect(effectiveAiMonthlyBudget({ keyMode: "platform", monthlyBudgetMicrounits: 0n })).toBe(0n);
    expect(effectiveAiMonthlyBudget({ keyMode: "byok", monthlyBudgetMicrounits: 9_000_000n })).toBe(
      9_000_000n,
    );
    expect(effectiveAiMonthlyBudget({ keyMode: "byok", monthlyBudgetMicrounits: null })).toBeNull();
  });
});
