import {
  type WorkspaceRole,
  canManageWorkspaceMembers,
  canWriteWorkspace,
  isWorkspaceReadOnly,
} from "@supastack/db";

export type { WorkspaceRole };

export type OnboardingGateId =
  "onboarding" | "new-organization" | "select-organization" | "choose-plan";

export type OnboardingGate = Readonly<{
  id: OnboardingGateId;
  path: string;
  title: string;
  summary: string;
}>;

export const ONBOARDING_GATES: readonly OnboardingGate[] = Object.freeze([
  {
    id: "onboarding",
    path: "/onboarding",
    title: "Finish setup",
    summary: "Create or select a workspace, then choose a product plan.",
  },
  {
    id: "new-organization",
    path: "/new-organization",
    title: "Create organization",
    summary: "Start a shared workspace with owner role for the creator.",
  },
  {
    id: "select-organization",
    path: "/select-organization",
    title: "Select workspace",
    summary: "Switch the active workspace for billing and product data.",
  },
  {
    id: "choose-plan",
    path: "/choose-plan",
    title: "Choose a plan",
    summary: "Pick Free, Pro, Lifetime, or Enterprise for the active workspace.",
  },
]);

export type MembershipSummary = Readonly<{
  role: WorkspaceRole;
  workspaceId: string;
  workspaceName: string;
  workspaceType: "personal" | "organization";
}>;

export function nextOnboardingPath(
  memberships: readonly MembershipSummary[],
  activeWorkspaceId: string | null,
): string {
  if (memberships.length === 0) {
    return "/new-organization";
  }
  if (
    activeWorkspaceId === null ||
    !memberships.some((membership) => membership.workspaceId === activeWorkspaceId)
  ) {
    return "/select-organization";
  }
  return "/choose-plan";
}

export function canManageMembers(role: WorkspaceRole): boolean {
  return canManageWorkspaceMembers(role);
}

export { canWriteWorkspace, isWorkspaceReadOnly as isReadOnlyRole };

export function normalizeOrganizationName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    return null;
  }
  return name;
}
