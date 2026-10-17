export interface EntitlementCardInput {
  action: { kind: "manage_on_web"; label: "Manage on the web" | "View plans on the web" };
  detail: string;
  status: "Active" | "No active entitlement" | "Past due" | "Trial";
  title: string;
  workspaceId: string | null;
}

export interface EntitlementCard {
  accessibilityLabel: string;
  action: EntitlementCardInput["action"];
  detail: string;
  status: EntitlementCardInput["status"];
  title: string;
}

export function createEntitlementCard(input: EntitlementCardInput): EntitlementCard {
  return {
    accessibilityLabel: `${input.title}. ${input.status}. ${input.detail}`,
    action: input.action,
    detail: input.detail,
    status: input.status,
    title: input.title,
  };
}
