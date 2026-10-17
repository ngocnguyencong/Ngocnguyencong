import { parsePublicConfig, parseServerConfig } from "@supastack/config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "../../src/onboarding-wizard";
import { listMembershipsForCurrentUser } from "../../src/organization-actions";
import { ONBOARDING_STEP_COOKIE, normalizeOnboardingStep } from "../../src/organization-constants";
import { productPlanPriceMapFromEnv, type ProductPlanId } from "../../src/product-plans";
import { WorkspaceShell } from "../../src/app-chrome";
import { getRequestBrand } from "../../src/custom-domains/runtime";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step: stepParam } = await searchParams;
  const jar = await cookies();
  const onboardingStep = normalizeOnboardingStep(jar.get(ONBOARDING_STEP_COOKIE)?.value ?? null);
  const requested = normalizeOnboardingStep(stepParam ?? null);

  // A previously completed wizard resumes at the dashboard unless a step is
  // explicitly requested again.
  if (!requested && onboardingStep === "done") {
    redirect("/dashboard");
  }

  const listed = await listMembershipsForCurrentUser();
  const brand = await getRequestBrand();
  if (!listed.ok) {
    redirect("/auth");
  }

  const serverConfig = parseServerConfig();
  const publicConfig = parsePublicConfig(serverConfig);
  const configuredPlanIds = Object.keys(productPlanPriceMapFromEnv(process.env)) as ProductPlanId[];

  return (
    <WorkspaceShell active="Dashboard" brand={brand}>
      <OnboardingWizard
        apiUrl={publicConfig.app.apiUrl}
        configuredPlanIds={configuredPlanIds}
        hasPersonalWorkspace={listed.memberships.some(
          (membership) => membership.workspaceType === "personal",
        )}
        initialStep={requested ?? onboardingStep ?? "profile"}
        stripeEnabled={publicConfig.providers.billing === "stripe"}
      />
    </WorkspaceShell>
  );
}
