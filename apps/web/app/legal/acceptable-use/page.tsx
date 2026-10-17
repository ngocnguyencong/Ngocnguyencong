import type { Metadata } from "next";
import { LegalPage } from "../../../src/marketing/legal-page";
import { legalDocument } from "../../../src/marketing/legal-content";
import { ResourceShell } from "../../../src/resources/resource-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Acceptable use",
  description:
    "The rules for using this product — fair use of the site and services, prohibited activity, and how violations are enforced.",
  alternates: { canonical: "/legal/acceptable-use" },
};

export default function Page() {
  return (
    <ResourceShell active="acceptable-use">
      <LegalPage document={legalDocument("acceptable-use")} />
    </ResourceShell>
  );
}
