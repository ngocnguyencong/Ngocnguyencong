import type { MobileApiClient } from "../api/client";

export interface WorkspaceMembership {
  role: string;
  workspaceId: string;
  workspaceName: string;
  workspaceType: "organization" | "personal";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMembership(value: unknown): value is WorkspaceMembership {
  return (
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.workspaceName === "string" &&
    typeof value.role === "string" &&
    (value.workspaceType === "organization" || value.workspaceType === "personal")
  );
}

/** `/api/workspaces` — list + switch the caller's workspace memberships. */
export function createMobileWorkspaceActions(api: MobileApiClient) {
  return {
    async list(): Promise<{
      activeWorkspaceId: string | null;
      memberships: WorkspaceMembership[];
    }> {
      const payload = await api.request<unknown>("/api/workspaces");
      if (!isRecord(payload) || !Array.isArray(payload.memberships)) {
        throw new Error("The workspace list was invalid.");
      }
      const memberships = payload.memberships.filter(isMembership);
      return {
        activeWorkspaceId:
          typeof payload.activeWorkspaceId === "string" ? payload.activeWorkspaceId : null,
        memberships,
      };
    },

    async switch(workspaceId: string): Promise<void> {
      await api.request("/api/workspaces", { body: { workspaceId }, method: "POST" });
    },
  };
}
