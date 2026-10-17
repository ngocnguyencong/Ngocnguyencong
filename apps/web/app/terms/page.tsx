import type { Metadata } from "next";
import { LegalPage } from "../../src/marketing/legal-page";
import { legalDocument } from "../../src/marketing/legal-content";
import { ResourceShell } from "../../src/resources/resource-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Terms",
  description:
    "supastack terms of use for the website and product. Billing runs through the configured payment provider.",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return (
    <ResourceShell active="terms">
      <LegalPage document={legalDocument("terms")} />
    </ResourceShell>
  );
}
