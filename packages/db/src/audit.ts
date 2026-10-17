export const AUDIT_ACTIONS = Object.freeze({
  accountSelfDeleted: "account.self_deleted",
  adminCreditsGranted: "admin.credits_granted",
  adminOrganizationDeleted: "admin.organization_deleted",
  adminUserBanned: "admin.user_banned",
  adminUserDeleted: "admin.user_deleted",
  adminUserImpersonated: "admin.user_impersonated",
  adminUserRoleChanged: "admin.user_role_changed",
  adminUserSessionsRevoked: "admin.user_sessions_revoked",
  adminUserUnbanned: "admin.user_unbanned",
  apiKeyCreated: "api_key.created",
  apiKeyRevoked: "api_key.revoked",
  commerceOrderCreated: "commerce_order.created",
  commerceOrderStatusChanged: "commerce_order.status_changed",
  commerceProductArchived: "commerce_product.archived",
  commerceProductCreated: "commerce_product.created",
  commerceProductUpdated: "commerce_product.updated",
  connectedAccountConnected: "connected_account.connected",
  connectedAccountDisconnected: "connected_account.disconnected",
  connectedAccountSmtpSaved: "connected_account.smtp_saved",
  connectedAccountTokenRefreshFailed: "connected_account.token_refresh_failed",
  contentEntryCreated: "content_entry.created",
  contentEntryDeleted: "content_entry.deleted",
  contentEntryStatusChanged: "content_entry.status_changed",
  earlyAccessCodeCreated: "early_access_code.created",
  earlyAccessCodeRedeemed: "early_access_code.redeemed",
  featureRequestCreated: "feature_request.created",
  featureRequestDeleted: "feature_request.deleted",
  featureRequestStatusChanged: "feature_request.status_changed",
  inviteAccepted: "invite.accepted",
  inviteCreated: "invite.created",
  inviteResent: "invite.resent",
  inviteRevoked: "invite.revoked",
  memberLeft: "member.left",
  memberRemoved: "member.removed",
  memberRoleChanged: "member.role_changed",
  organizationCreated: "organization.created",
  organizationDeleted: "organization.deleted",
  organizationLogoUploaded: "organization.logo_uploaded",
  organizationRenamed: "organization.renamed",
  sessionRevoked: "session.revoked",
  sessionOthersRevoked: "session.others_revoked",
  waitlistInvited: "waitlist.invited",
  waitlistJoined: "waitlist.joined",
  waitlistRemoved: "waitlist.removed",
  webhookEndpointCreated: "webhook_endpoint.created",
  webhookEndpointDeleted: "webhook_endpoint.deleted",
  workspaceAiBudgetUpdated: "workspace.ai_budget_updated",
  workspaceDataExported: "workspace.data_exported",
  workspaceDomainAdded: "workspace_domain.added",
  workspaceDomainRemoved: "workspace_domain.removed",
  workspaceDomainVerified: "workspace_domain.verified",
  workspaceExportDownloaded: "workspace.export_downloaded",
  workspaceUsageCapUpdated: "workspace.usage_cap_updated",
} as const);

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEventRecordInput {
  action: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
  targetId?: string | null;
  targetType?: string | null;
  workspaceId?: string | null;
}

export interface AuditEventRecord {
  action: string;
  actorUserId: string | null;
  createdAt: Date;
  id: string;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  targetId: string | null;
  targetType: string | null;
  workspaceId: string | null;
}

export function createAuditEventRecord(
  dependencies: { createId: () => string; now: () => Date },
  input: AuditEventRecordInput,
): AuditEventRecord {
  return {
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    createdAt: dependencies.now(),
    id: dependencies.createId(),
    ipAddress: input.ipAddress ?? null,
    metadata: input.metadata ?? null,
    targetId: input.targetId ?? null,
    targetType: input.targetType ?? null,
    workspaceId: input.workspaceId ?? null,
  };
}

const ACTION_LABELS: Record<string, string> = {
  "account.self_deleted": "Account deleted",
  "admin.credits_granted": "Workspace credits granted by admin",
  "admin.organization_deleted": "Organization deleted by admin",
  "admin.user_banned": "User banned by admin",
  "admin.user_deleted": "User deleted by admin",
  "admin.user_impersonated": "User impersonated by admin",
  "admin.user_role_changed": "User role changed by admin",
  "admin.user_sessions_revoked": "User sessions revoked by admin",
  "admin.user_unbanned": "User unbanned by admin",
  "api_key.created": "API key created",
  "api_key.revoked": "API key revoked",
  "commerce_order.created": "Order created",
  "commerce_order.status_changed": "Order status changed",
  "commerce_product.archived": "Product archived",
  "commerce_product.created": "Product created",
  "commerce_product.updated": "Product updated",
  "connected_account.connected": "External account connected",
  "connected_account.disconnected": "External account disconnected",
  "connected_account.smtp_saved": "SMTP account saved",
  "connected_account.token_refresh_failed": "External account token refresh failed",
  "content_entry.created": "Content entry created",
  "content_entry.deleted": "Content entry deleted",
  "content_entry.status_changed": "Content entry status changed",
  "early_access_code.created": "Early-access code created",
  "early_access_code.redeemed": "Early-access code redeemed",
  "feature_request.created": "Feature request created",
  "feature_request.deleted": "Feature request deleted",
  "feature_request.status_changed": "Feature request status changed",
  "invite.accepted": "Invite accepted",
  "invite.created": "Invite created",
  "invite.resent": "Invite resent",
  "invite.revoked": "Invite revoked",
  "member.left": "Member left",
  "member.removed": "Member removed",
  "member.role_changed": "Member role changed",
  "organization.created": "Organization created",
  "organization.deleted": "Organization deleted",
  "organization.logo_uploaded": "Organization logo uploaded",
  "organization.renamed": "Organization renamed",
  "session.others_revoked": "Other sessions revoked",
  "session.revoked": "Session revoked",
  "waitlist.invited": "Waitlist invite sent",
  "waitlist.joined": "Waitlist signup",
  "waitlist.removed": "Waitlist entry removed",
  "webhook_endpoint.created": "Webhook endpoint created",
  "webhook_endpoint.deleted": "Webhook endpoint deleted",
  "workspace.ai_budget_updated": "AI monthly budget updated",
  "workspace.data_exported": "Workspace data export downloaded",
  "workspace_domain.added": "Custom domain added",
  "workspace_domain.removed": "Custom domain removed",
  "workspace_domain.verified": "Custom domain verified",
  "workspace.export_downloaded": "Workspace data exported",
  "workspace.usage_cap_updated": "Workspace usage cap updated",
};

export function describeAuditEvent(event: { action: string; targetId?: string | null }): string {
  return ACTION_LABELS[event.action] ?? event.action;
}
