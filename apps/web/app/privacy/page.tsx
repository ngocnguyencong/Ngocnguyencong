import type { Metadata } from "next";
import { LegalPage } from "../../src/marketing/legal-page";
import { legalDocument } from "../../src/marketing/legal-content";
import { ResourceShell } from "../../src/resources/resource-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How supastack handles account, workspace, billing, and contact information. No invented certifications.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return (
    <ResourceShell active="privacy">
      <LegalPage document={legalDocument("privacy")} />
    </ResourceShell>
  );
}
