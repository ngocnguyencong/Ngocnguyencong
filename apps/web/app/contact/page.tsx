import { parsePublicConfig, parseServerConfig } from "@supastack/config";
import type { Metadata } from "next";
import { ContactPage } from "../../src/marketing/contact-page";
import { ResourceShell } from "../../src/resources/resource-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contact",
  description: "Write to supastack or leave an email for product notes. No subscriber counts.",
  alternates: { canonical: "/contact" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; form?: string | string[] }>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const form = typeof params.form === "string" ? params.form : undefined;
  const { captcha } = parsePublicConfig(parseServerConfig());
  return (
    <ResourceShell active="contact">
      <ContactPage
        status={status}
        form={form}
        turnstileSiteKey={captcha.provider === "turnstile" ? captcha.turnstileSiteKey : undefined}
      />
    </ResourceShell>
  );
}
