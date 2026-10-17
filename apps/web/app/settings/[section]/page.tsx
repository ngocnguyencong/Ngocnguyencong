import { parsePublicConfig, parseServerConfig } from "@supastack/config";
import { LOCALE_COOKIE, getDictionary, resolveLocale } from "@supastack/i18n";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { listMySessions } from "../../../src/account-actions";
import { listWorkspaceApiKeys } from "../../../src/api-keys-actions";
import { loadConnectionsPanelData } from "../../../src/connections-panel-data";
import { listWorkspaceDomains } from "../../../src/custom-domains/domain-actions";
import { listWorkspaceAuditEvents } from "../../../src/audit-runtime";
import { listActiveOrganizationMembers } from "../../../src/organization-actions";
import { listWebhookEndpoints } from "../../../src/webhooks-actions";
import { listWorkspaceSchedules } from "../../../src/schedule-actions";
import { getRequestBrand } from "../../../src/custom-domains/runtime";
import { loadUsagePanelData } from "../../../src/usage-overview";
import { canExportWorkspaceData } from "../../../src/workspace-access";
import { WebSettingsPage } from "../../../src/web-settings-page";
import { isSettingsSectionId } from "../../../src/web-settings-sections";

type PageProps = Readonly<{
  params: Promise<{ section: string }>;
  searchParams: Promise<{ status?: string }>;
}>;

export default async function SettingsSectionPage({ params, searchParams }: PageProps) {
  const { section: raw } = await params;
  const { status } = await searchParams;
  if (!isSettingsSectionId(raw)) {
    notFound();
  }
  const serverConfig = parseServerConfig();
  const config = parsePublicConfig(serverConfig);
  const jar = await cookies();
  const requestHeaders = await headers();
  const locale = resolveLocale([
    jar.get(LOCALE_COOKIE)?.value,
    requestHeaders.get("x-supastack-locale"),
    requestHeaders.get("accept-language"),
  ]);
  const dictionary = getDictionary(locale);
  const members = raw === "members" ? await listActiveOrganizationMembers() : undefined;
  const developers =
    raw === "developers"
      ? {
          apiKeys: await listWorkspaceApiKeys(),
          schedules: await listWorkspaceSchedules(),
          webhooks: await listWebhookEndpoints(),
        }
      : undefined;
  const audit = raw === "audit" ? await listWorkspaceAuditEvents() : undefined;
  const sessions = raw === "security" ? await listMySessions() : undefined;
  const domains = raw === "domains" ? await listWorkspaceDomains() : undefined;
  const connections =
    raw === "connections"
      ? await loadConnectionsPanelData({
          copy: dictionary.settings.sections.connections,
          locale,
        })
      : undefined;
  const usage = raw === "usage" ? await loadUsagePanelData() : undefined;
  // Fails closed: outside a request scope (or on any lookup error) the card
  // simply stays hidden — the export route re-checks the role anyway.
  const canExportWorkspace = raw === "general" ? await canExportWorkspaceData() : false;
  const brand = await getRequestBrand();

  return (
    <WebSettingsPage
      apiUrl={config.app.apiUrl}
      brand={brand}
      canExportWorkspace={canExportWorkspace}
      connections={connections}
      domains={domains}
      audit={audit}
      developers={developers}
      locale={locale}
      members={members}
      notificationCopy={dictionary.notifications}
      section={raw}
      sessions={sessions}
      settingsTitle={dictionary.settings.title}
      status={status}
      usage={usage}
      workspaceExportCopy={dictionary.settings.workspaceExport}
    />
  );
}
