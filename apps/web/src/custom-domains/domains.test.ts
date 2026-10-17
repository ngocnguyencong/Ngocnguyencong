import { describe, expect, it } from "vitest";

import {
  applyRemoteHostnameStatus,
  canAddDomain,
  MAX_DOMAINS_PER_WORKSPACE,
  type StoredDomainRow,
} from "./domains";
import type { CustomHostname } from "./provider";

const baseRow: StoredDomainRow = {
  hostname: "portal.acme.test",
  id: "dom_1",
  lastCheckedAt: null,
  providerHostnameId: "ch_1",
  sslStatus: "pending_validation",
  status: "pending",
  verification: {
    cnameTarget: "customers.supastack.dev",
    dcvRecords: [{ txtName: "_acme-challenge.portal.acme.test", txtValue: "dcv-1" }],
    ownership: { name: "_cf-custom-hostname.portal.acme.test", type: "txt", value: "own" },
  },
  verifiedAt: null,
  workspaceId: "ws_1",
};

const now = new Date("2026-09-22T12:00:00Z");

function remote(status: CustomHostname["status"]): CustomHostname {
  return {
    hostname: "portal.acme.test",
    id: "ch_1",
    sslStatus: status === "active" ? "active" : "pending_validation",
    status,
    verification: {
      cnameTarget: "customers.supastack.dev",
      dcvRecords: [{ txtName: "_acme-challenge.portal.acme.test", txtValue: "dcv-2" }],
    },
  };
}

describe("canAddDomain", () => {
  it("enforces the per-workspace cap", () => {
    expect(canAddDomain(0)).toBe(true);
    expect(canAddDomain(MAX_DOMAINS_PER_WORKSPACE - 1)).toBe(true);
    expect(canAddDomain(MAX_DOMAINS_PER_WORKSPACE)).toBe(false);
    expect(canAddDomain(MAX_DOMAINS_PER_WORKSPACE + 2)).toBe(false);
  });
});

describe("applyRemoteHostnameStatus", () => {
  it("marks pending→active as a fresh verification", () => {
    const result = applyRemoteHostnameStatus(baseRow, remote("active"), now);
    expect(result.newlyVerified).toBe(true);
    expect(result.patch.status).toBe("active");
    expect(result.patch.verifiedAt).toEqual(now);
    expect(result.patch.lastCheckedAt).toEqual(now);
    expect(result.patch.sslStatus).toBe("active");
    // Verification records refresh so the UI always shows current DCV data.
    expect(result.patch.verification?.dcvRecords[0]?.txtValue).toBe("dcv-2");
  });

  it("does not re-verify a row that is already active", () => {
    const result = applyRemoteHostnameStatus(
      { ...baseRow, status: "active", verifiedAt: new Date("2026-09-20T00:00:00Z") },
      remote("active"),
      now,
    );
    expect(result.newlyVerified).toBe(false);
    expect(result.patch.verifiedAt).toEqual(new Date("2026-09-20T00:00:00Z"));
  });

  it("clears verifiedAt when a verified domain moves away or is deleted", () => {
    const verified = { ...baseRow, status: "active" as const, verifiedAt: now };
    for (const status of ["moved", "deleted", "failed"] as const) {
      const result = applyRemoteHostnameStatus(verified, remote(status), now);
      expect(result.patch.status, status).toBe(status);
      expect(result.patch.verifiedAt, status).toBeNull();
      expect(result.newlyVerified, status).toBe(false);
    }
  });

  it("keeps pending rows unverified", () => {
    const result = applyRemoteHostnameStatus(baseRow, remote("pending"), now);
    expect(result.newlyVerified).toBe(false);
    expect(result.patch.status).toBe("pending");
    expect(result.patch.verifiedAt).toBeNull();
  });
});
