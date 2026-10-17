import type { CustomHostname, DomainVerification } from "./provider";

/** Pure custom-domain lifecycle rules shared by the server actions. */

export const MAX_DOMAINS_PER_WORKSPACE = 5;

export interface StoredDomainRow {
  hostname: string;
  id: string;
  lastCheckedAt: Date | null;
  providerHostnameId: string | null;
  sslStatus: string | null;
  status: string;
  verification: DomainVerification | null;
  verifiedAt: Date | null;
  workspaceId: string;
}

export function canAddDomain(currentCount: number): boolean {
  return currentCount < MAX_DOMAINS_PER_WORKSPACE;
}

export interface DomainStatusPatch {
  lastCheckedAt: Date;
  sslStatus: string | null;
  status: string;
  verification: DomainVerification | null;
  verifiedAt: Date | null;
}

/**
 * Maps a fresh provider read onto the stored row. `newlyVerified` is true only
 * for a non-active → active transition, which is when the workspace webhook
 * `domain.verified` fires.
 */
export function applyRemoteHostnameStatus(
  row: Pick<StoredDomainRow, "status" | "verifiedAt">,
  remote: CustomHostname,
  now: Date,
): { newlyVerified: boolean; patch: DomainStatusPatch } {
  const becameActive = remote.status === "active" && row.status !== "active";
  const lostActive = remote.status !== "active" && row.status === "active";
  return {
    newlyVerified: becameActive,
    patch: {
      lastCheckedAt: now,
      sslStatus: remote.sslStatus,
      status: remote.status,
      verification: remote.verification,
      verifiedAt: becameActive ? now : lostActive ? null : row.verifiedAt,
    },
  };
}
