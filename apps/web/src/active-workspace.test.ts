import { describe, expect, it } from "vitest";

import { readActiveWorkspaceCookie, resolveBillingWorkspaceId } from "./active-workspace.js";
import { ACTIVE_WORKSPACE_COOKIE } from "./organization-constants.js";

describe("active workspace resolution", () => {
  it("prefers a membership-valid cookie over preference and personal fallback", () => {
    expect(
      resolveBillingWorkspaceId({
        cookieWorkspaceId: "ws_org",
        preferredWorkspaceId: "ws_personal",
        memberships: [
          { role: "owner", workspaceId: "ws_personal", workspaceType: "personal" },
          { role: "owner", workspaceId: "ws_org", workspaceType: "organization" },
        ],
      }),
    ).toBe("ws_org");
  });

  it("ignores cookies for workspaces the user left", () => {
    expect(
      resolveBillingWorkspaceId({
        cookieWorkspaceId: "ws_gone",
        preferredWorkspaceId: "ws_org",
        memberships: [
          { role: "owner", workspaceId: "ws_personal", workspaceType: "personal" },
          { role: "admin", workspaceId: "ws_org", workspaceType: "organization" },
        ],
      }),
    ).toBe("ws_org");
  });

  it("parses the active workspace cookie from the Cookie header", () => {
    expect(
      readActiveWorkspaceCookie(`session=abc; ${ACTIVE_WORKSPACE_COOKIE}=ws_org; other=1`),
    ).toBe("ws_org");
    expect(readActiveWorkspaceCookie(null)).toBeNull();
  });
});
