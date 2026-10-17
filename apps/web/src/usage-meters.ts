import { PRODUCT_PLANS, type ProductPlan } from "./product-plans";

/** A usage meter surfaced on Settings → Usage and the mobile usage card. */
export type UsageMeter = Readonly<{
  key: string;
  label: string;
  description: string;
}>;

/**
 * The meter catalog: the shipped `ai.requests` meter plus every key any
 * plan declares in `usageLimits` — derived products that add plan meters
 * appear here automatically, so caps and the overview stay in sync with
 * the catalog.
 */
export function usageMeters(plans: readonly ProductPlan[] = PRODUCT_PLANS): readonly UsageMeter[] {
  const meters: UsageMeter[] = [
    {
      key: "ai.requests",
      label: "AI requests",
      description: "AI tasks started in this workspace.",
    },
  ];
  const seen = new Set(meters.map((meter) => meter.key));
  for (const plan of plans) {
    for (const key of Object.keys(plan.usageLimits ?? {})) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      meters.push({
        key,
        label: key,
        description: "Usage metered by the workspace plan.",
      });
    }
  }
  return Object.freeze(meters);
}

export const USAGE_METERS: readonly UsageMeter[] = usageMeters();
