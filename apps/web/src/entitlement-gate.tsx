import type { ReactNode } from "react";

import { hasActiveEntitlement } from "./entitlement-check";
import { listViewerEntitlements } from "./entitlements";

/**
 * Web paywall gate: renders `children` when the active workspace holds the
 * entitlement, otherwise an upgrade prompt (or `fallback` when provided).
 * Server-only — entitlement reads never trust the client.
 */
export async function EntitlementGate({
  children,
  entitlementKey,
  fallback,
}: Readonly<{
  children: ReactNode;
  entitlementKey: string;
  fallback?: ReactNode | undefined;
}>) {
  const { entitlements } = await listViewerEntitlements();

  if (hasActiveEntitlement(entitlements, entitlementKey)) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <section className="auth-card" aria-label="Upgrade required">
      <div className="auth-heading">
        <h2>Upgrade required</h2>
        <p>
          This feature needs the <code>{entitlementKey}</code> entitlement. Choose a plan to
          continue.
        </p>
      </div>
      <a className="button button-primary" href="/billing">
        View plans
      </a>
    </section>
  );
}
