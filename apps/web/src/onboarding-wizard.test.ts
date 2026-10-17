import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("onboarding wizard", () => {
  it("renders the multi-step wizard from the onboarding page with resumable state", () => {
    const page = readWeb("app/onboarding/page.tsx");
    expect(page).toContain("OnboardingWizard");
    expect(page).toContain("searchParams");
    expect(page).toContain("onboardingStep");
    expect(page).toContain('redirect("/dashboard")');
  });

  it("implements profile, workspace, and plan steps with a progress indicator", () => {
    const wizard = readWeb("src/onboarding-wizard.tsx");
    expect(wizard).toContain('"use client"');
    for (const step of ['"profile"', '"workspace"', '"plan"', '"done"']) {
      expect(wizard).toContain(step);
    }
    expect(wizard).toContain("onboarding-steps");
    expect(wizard).toContain("aria-current");
    expect(wizard).toContain("useRouter");
  });

  it("saves profile name through the auth client and uploads avatar via storage API", () => {
    const wizard = readWeb("src/onboarding-wizard.tsx");
    expect(wizard).toContain("updateUser");
    expect(wizard).toContain("/api/storage/avatar");
    expect(wizard).toContain('name="avatar"');
  });

  it("creates organizations and uploads logos through dedicated API routes", () => {
    const wizard = readWeb("src/onboarding-wizard.tsx");
    expect(wizard).toContain("/api/onboarding/organization");
    expect(wizard).toContain("/api/storage/logo");
  });

  it("offers plan selection wired to billing checkout and dashboard completion", () => {
    const wizard = readWeb("src/onboarding-wizard.tsx");
    expect(wizard).toContain("PRODUCT_PLANS");
    expect(wizard).toContain("/api/billing/checkout");
    expect(wizard).toContain("/dashboard");
    expect(wizard).toContain("/api/onboarding/state");
  });

  it("guards the organization route with session and name validation", () => {
    const route = readWeb("app/api/onboarding/organization/route.ts");
    expect(route).toContain("getAuthSession");
    expect(route).toContain("status: 401");
    expect(route).toContain("normalizeOrganizationName");
    expect(route).toContain("createOrganizationWorkspaceRecords");
    expect(route).toContain("ACTIVE_WORKSPACE_COOKIE");
    expect(route).toContain("userWorkspacePreference");
  });

  it("persists the current step through the onboarding state route", () => {
    const route = readWeb("app/api/onboarding/state/route.ts");
    expect(route).toContain("ONBOARDING_STEP_COOKIE");
    expect(route).toMatch(/\.set\(ONBOARDING_STEP_COOKIE/);
    expect(route).toContain("status: 400");
  });

  it("styles wizard steps with app theme tokens", () => {
    const css = readWeb("app/app-theme.css");
    expect(css).toContain(".onboarding-steps");
    expect(css).toMatch(/\.onboarding-step-active\s*\{[^}]*var\(--accent\)/s);
    expect(css).toMatch(/\.onboarding-steps\s*\{[^}]*var\(--muted\)/s);
  });
});
