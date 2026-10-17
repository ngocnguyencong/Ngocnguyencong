export type ReferenceScreen = "dashboard" | "billing" | "task" | "settings";

export const referenceNavigation = [
  { label: "Dashboard", screen: "dashboard" },
  { label: "Billing", screen: "billing" },
  { label: "AI task", screen: "task" },
  { label: "Settings", screen: "settings" },
] as const satisfies readonly Readonly<{ label: string; screen: ReferenceScreen }>[];

export function joinClassNames(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");
}
