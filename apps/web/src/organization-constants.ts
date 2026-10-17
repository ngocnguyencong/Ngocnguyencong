export const ACTIVE_WORKSPACE_COOKIE = "supastack.activeWorkspaceId";
export const ONBOARDING_STEP_COOKIE = "supastack.onboardingStep";

export const ONBOARDING_STEPS = ["profile", "workspace", "plan", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function normalizeOnboardingStep(value: string | null | undefined): OnboardingStep | null {
  return (ONBOARDING_STEPS as readonly string[]).includes(value ?? "")
    ? (value as OnboardingStep)
    : null;
}
