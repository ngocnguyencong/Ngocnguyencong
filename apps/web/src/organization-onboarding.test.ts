import { describe, expect, it } from "vitest";

import {
  canManageMembers,
  canWriteWorkspace,
  isReadOnlyRole,
  nextOnboardingPath,
  normalizeOrganizationName,
  ONBOARDING_GATES,
} from "./organization-onboarding.js";

describe("organization onboarding gates", () => {
  it("exposes the demo gate routes", () => {
    expect(ONBOARDING_GATES.map((gate) => gate.path)).toEqual([
      "/onboarding",
      "/new-organization",
      "/select-organization",
      "/choose-plan",
    ]);
  });

  it("routes users through create → select → choose-plan", () => {
    expect(nextOnboardingPath([], null)).toBe("/new-organization");
    expect(
      nextOnboardingPath(
        [
          {
            role: "owner",
            workspaceId: "ws_1",
            workspaceName: "Acme",
            workspaceType: "organization",
          },
        ],
        null,
      ),
    ).toBe("/select-organization");
    expect(
      nextOnboardingPath(
        [
          {
            role: "owner",
            workspaceId: "ws_1",
            workspaceName: "Acme",
            workspaceType: "organization",
          },
        ],
        "ws_1",
      ),
    ).toBe("/choose-plan");
  });

  it("validates organization names and member management roles", () => {
    expect(normalizeOrganizationName("  Acme  ")).toBe("Acme");
    expect(normalizeOrganizationName("A")).toBeNull();
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("member")).toBe(false);
    expect(canManageMembers("guest")).toBe(false);

    expect(canWriteWorkspace("owner")).toBe(true);
    expect(canWriteWorkspace("admin")).toBe(true);
    expect(canWriteWorkspace("member")).toBe(true);
    expect(canWriteWorkspace("guest")).toBe(false);

    expect(isReadOnlyRole("guest")).toBe(true);
    expect(isReadOnlyRole("member")).toBe(false);
    expect(isReadOnlyRole("admin")).toBe(false);
    expect(isReadOnlyRole("owner")).toBe(false);
  });

  it("handles guest memberships in onboarding routing", () => {
    expect(
      nextOnboardingPath(
        [
          {
            role: "guest",
            workspaceId: "ws_guest",
            workspaceName: "Acme Guest",
            workspaceType: "organization",
          },
        ],
        "ws_guest",
      ),
    ).toBe("/choose-plan");
  });
});
