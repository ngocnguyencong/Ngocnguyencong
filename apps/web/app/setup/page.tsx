import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getAdminSession } from "../../src/admin-actions";
import { WorkspaceShell } from "../../src/app-chrome";
import { getAuthSession } from "../../src/auth-runtime";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { evaluateSetupReadiness } from "../../src/setup-readiness";
import { collectSetupSnapshot } from "../../src/setup-readiness-runtime";
import { SetupReportView } from "../../src/setup-page";
import styles from "../../src/setup-page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false },
  title: "Setup",
};

/**
 * In-app readiness checklist. Development is open to anyone (a fresh clone
 * should show the checklist before sign-in exists); outside development only
 * platform admins may view it — everyone else sees a 404, same posture as
 * the other operator surfaces.
 */
export default async function SetupPage() {
  const isDevelopment = process.env.NODE_ENV === "development";
  if (!isDevelopment) {
    const admin = await getAdminSession();
    if (admin === null) {
      notFound();
    }
  }

  const report = evaluateSetupReadiness(await collectSetupSnapshot());
  const session = await getAuthSession(await headers());

  // Signed-in viewers get the app chrome; anonymous dev visitors get the
  // plain utility layout the status page uses.
  if (session === null) {
    return (
      <div className="token-root app-theme">
        <main className={`main-panel ${styles.shell}`}>
          <SetupReportView report={report} />
        </main>
      </div>
    );
  }

  return (
    <WorkspaceShell active="Settings" brand={await getRequestBrand()}>
      <SetupReportView report={report} />
    </WorkspaceShell>
  );
}
