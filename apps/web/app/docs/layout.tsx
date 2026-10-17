import type { ReactNode } from "react";
import { headers } from "next/headers";
import { resolveLocale } from "@supastack/i18n";
import { ResourceShell } from "../../src/resources/resource-shell";
export default async function DocsLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const locale = resolveLocale([requestHeaders.get("x-supastack-locale")]);
  return (
    <ResourceShell active="docs" locale={locale}>
      {children}
    </ResourceShell>
  );
}
