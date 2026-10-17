import type { Metadata } from "next";
import { LegalPage } from "../../../src/marketing/legal-page";
import { legalDocument } from "../../../src/marketing/legal-content";
import { ResourceShell } from "../../../src/resources/resource-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "License",
  description:
    "What a supastack license covers — codebase access, what you can build and sell, seats, and the redistribution rules.",
  alternates: { canonical: "/legal/license" },
};

export default function Page() {
  return (
    <ResourceShell active="license">
      <LegalPage document={legalDocument("license")} />
    </ResourceShell>
  );
}
