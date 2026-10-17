import type { Metadata } from "next";
import { ShowcasePage } from "../../src/marketing/showcase-page";
import { ResourceShell } from "../../src/resources/resource-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Showcase",
  description: "Products built on supastack. The list stays empty until a team asks to be listed.",
  alternates: { canonical: "/showcase" },
};

export default function Page() {
  return (
    <ResourceShell active="showcase">
      <ShowcasePage />
    </ResourceShell>
  );
}
