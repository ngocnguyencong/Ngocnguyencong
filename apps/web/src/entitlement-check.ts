export type EntitlementRecord = Readonly<{
  expiresAt: Date | null;
  key: string;
  status: string;
}>;

/**
 * Pure entitlement check shared by the web paywall gate. Active and trialing
 * grants apply until `expiresAt` (null = no expiry).
 */
export function hasActiveEntitlement(
  entitlements: readonly EntitlementRecord[],
  key: string,
  now: Date = new Date(),
): boolean {
  return entitlements.some(
    (entry) =>
      entry.key === key &&
      (entry.status === "active" || entry.status === "trialing") &&
      (entry.expiresAt === null || entry.expiresAt > now),
  );
}
