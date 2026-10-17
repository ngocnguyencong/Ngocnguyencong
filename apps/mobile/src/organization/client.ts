import type { MobileApiClient } from "../api/client";

export type OrganizationRole = "admin" | "guest" | "member" | "owner";

export interface OrganizationMember {
  email: string;
  name: string;
  role: OrganizationRole;
  userId: string;
}

export interface PendingInvitation {
  email: string;
  expired: boolean;
  expiresAt: string;
  id: string;
  role: string;
}

export interface OrganizationMembersPayload {
  canLeave: boolean;
  canManage: boolean;
  currentRole: OrganizationRole;
  currentUserId: string;
  members: OrganizationMember[];
  pendingInvitations: PendingInvitation[];
  seatCount: number;
  seatLimit: number | null;
  workspaceId: string;
  workspaceName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dataRecord(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error("The organization response was invalid.");
  }
  return payload.data;
}

/** `/api/mobile/{organization,members,invitations}` — the members + org surface. */
export function createMobileOrganizationActions(api: MobileApiClient) {
  return {
    async acceptInvite(token: string): Promise<string> {
      const data = dataRecord(
        await api.request("/api/mobile/invitations/accept", { body: { token }, method: "POST" }),
      );
      if (typeof data.workspaceId !== "string") {
        throw new Error("The invite could not be accepted.");
      }
      return data.workspaceId;
    },

    async createOrganization(name: string): Promise<string> {
      const data = dataRecord(
        await api.request("/api/mobile/organization", { body: { name }, method: "POST" }),
      );
      if (typeof data.workspaceId !== "string") {
        throw new Error("The organization could not be created.");
      }
      return data.workspaceId;
    },

    async deleteOrganization(confirm: string): Promise<void> {
      await api.request("/api/mobile/organization", {
        body: { confirm },
        method: "DELETE",
      });
    },

    async invite(email: string, role?: string): Promise<string> {
      const data = dataRecord(
        await api.request("/api/mobile/invitations", {
          body: { email, role },
          method: "POST",
        }),
      );
      if (typeof data.invitationId !== "string") {
        throw new Error("The invitation could not be created.");
      }
      return data.invitationId;
    },

    async leave(): Promise<void> {
      await api.request("/api/mobile/members/leave", { method: "POST" });
    },

    async listMembers(): Promise<OrganizationMembersPayload> {
      const data = dataRecord(await api.request("/api/mobile/organization"));
      const members = Array.isArray(data.members)
        ? data.members.filter(
            (row): row is OrganizationMember =>
              isRecord(row) &&
              typeof row.email === "string" &&
              typeof row.name === "string" &&
              typeof row.role === "string" &&
              typeof row.userId === "string",
          )
        : [];
      const pendingInvitations = Array.isArray(data.pendingInvitations)
        ? data.pendingInvitations.filter(
            (row): row is PendingInvitation =>
              isRecord(row) &&
              typeof row.id === "string" &&
              typeof row.email === "string" &&
              typeof row.expiresAt === "string" &&
              typeof row.expired === "boolean" &&
              typeof row.role === "string",
          )
        : [];
      return {
        canLeave: data.canLeave === true,
        canManage: data.canManage === true,
        currentRole: (typeof data.currentRole === "string"
          ? data.currentRole
          : "member") as OrganizationRole,
        currentUserId: typeof data.currentUserId === "string" ? data.currentUserId : "",
        members,
        pendingInvitations,
        seatCount: typeof data.seatCount === "number" ? data.seatCount : members.length,
        seatLimit: typeof data.seatLimit === "number" ? data.seatLimit : null,
        workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : "",
        workspaceName: typeof data.workspaceName === "string" ? data.workspaceName : "",
      };
    },

    async removeMember(userId: string): Promise<void> {
      await api.request(`/api/mobile/members/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
    },

    async renameOrganization(name: string): Promise<void> {
      await api.request("/api/mobile/organization", { body: { name }, method: "PATCH" });
    },

    async resendInvite(invitationId: string): Promise<void> {
      await api.request(`/api/mobile/invitations/${encodeURIComponent(invitationId)}/resend`, {
        method: "POST",
      });
    },

    async revokeInvite(invitationId: string): Promise<void> {
      await api.request(`/api/mobile/invitations/${encodeURIComponent(invitationId)}`, {
        method: "DELETE",
      });
    },

    async updateRole(userId: string, role: OrganizationRole): Promise<void> {
      await api.request(`/api/mobile/members/${encodeURIComponent(userId)}`, {
        body: { role },
        method: "PATCH",
      });
    },
  };
}
