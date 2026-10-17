import { hasActiveEntitlement, type EntitlementRecord } from "./entitlement-check";

/** True when the row requires an entitlement the viewer does not hold. */
export function isContentLocked(
  requiredEntitlement: string | null,
  viewerEntitlements: readonly EntitlementRecord[],
  now: Date = new Date(),
): boolean {
  return (
    requiredEntitlement !== null &&
    !hasActiveEntitlement(viewerEntitlements, requiredEntitlement, now)
  );
}

/**
 * Projects raw rows for a reader: gated rows keep teaser metadata but lose
 * `body` — the server never ships locked bodies to the wire.
 */
export function applyContentAccess<
  Row extends { body: string; requiredEntitlement: string | null },
>(
  rows: readonly Row[],
  viewerEntitlements: readonly EntitlementRecord[],
  now: Date = new Date(),
): readonly (Row & { locked: boolean })[] {
  return rows.map((row) => {
    const locked = isContentLocked(row.requiredEntitlement, viewerEntitlements, now);
    return { ...row, body: locked ? "" : row.body, locked };
  });
}
