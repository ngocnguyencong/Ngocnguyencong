import type { Metadata } from "next";
import { LegalPage } from "../../../src/marketing/legal-page";
import { legalDocument } from "../../../src/marketing/legal-content";
import { ResourceShell } from "../../../src/resources/resource-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "This site's content is general information, not professional advice — no warranties, external links, and liability limits.",
  alternates: { canonical: "/legal/disclaimer" },
};

export default function Page() {
  return (
    <ResourceShell active="disclaimer">
      <LegalPage document={legalDocument("disclaimer")} />
    </ResourceShell>
  );
}
