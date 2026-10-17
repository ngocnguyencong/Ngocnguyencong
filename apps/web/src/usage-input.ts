import { MAX_USAGE_QUOTA } from "@supastack/db";

/** Dollar ceiling for the monthly AI budget — matches the regex's 6 digits. */
export const MAX_AI_MONTHLY_BUDGET_DOLLARS = 100_000;

/**
 * Dollar-string → bigint microunits: `"12.50"` → `12500000n`. Strict —
 * `^\d{1,6}(\.\d{1,2})?$` with a $100,000 ceiling; anything else (`"1.234"`,
 * `"-1"`, `"abc"`, empty) returns `null` so the action can redirect
 * `status=invalid` without a write.
 */
export function parseAiBudgetMicrounits(raw: string): bigint | null {
  const value = raw.trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value)) {
    return null;
  }
  const [whole = "0", fraction = ""] = value.split(".");
  const microunits = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0") || "0");
  return microunits <= BigInt(MAX_AI_MONTHLY_BUDGET_DOLLARS) * 1_000_000n ? microunits : null;
}

/** Parsed `cap` form value — empty/`clear=1` clears, integer 0..MAX sets. */
export type ParsedUsageCap =
  | Readonly<{ kind: "clear" }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "set"; cap: number }>;

export function parseUsageCapInput(raw: string, clearFlag: string): ParsedUsageCap {
  const value = raw.trim();
  if (clearFlag === "1" || value.length === 0) {
    return { kind: "clear" };
  }
  if (!/^\d{1,10}$/.test(value)) {
    return { kind: "invalid" };
  }
  const cap = Number(value);
  if (!Number.isSafeInteger(cap) || cap < 0 || cap > MAX_USAGE_QUOTA) {
    return { kind: "invalid" };
  }
  return { kind: "set", cap };
}
