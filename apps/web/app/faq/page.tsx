import type { Metadata } from "next";
import { ResourceShell } from "../../src/resources/resource-shell";
import { FaqBrowser } from "../../src/marketing/faq-browser";
import { faqPageJsonLd, JsonLd } from "../../src/marketing/seo";
import { siteConfig } from "../../src/marketing/site-config";
import s from "../../src/marketing/faq-browser.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about supastack, supported platforms, AI providers, billing, and getting started.",
  alternates: { canonical: "/faq" },
};
export default function Page() {
  return (
    <ResourceShell active="faq">
      <main id="main" className={s.page}>
        <JsonLd data={faqPageJsonLd(siteConfig.faq)} />
        <h1>Frequently asked questions</h1>
        <FaqBrowser />
      </main>
    </ResourceShell>
  );
}
