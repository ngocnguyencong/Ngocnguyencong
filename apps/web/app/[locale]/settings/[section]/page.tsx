import { parsePublicConfig, parseServerConfig } from "@supastack/config";
import { getDictionary, isAppLocale } from "@supastack/i18n";
import { notFound, redirect } from "next/navigation";

import { listMySessions } from "../../../../src/account-actions";
import { listWorkspaceApiKeys } from "../../../../src/api-keys-actions";
import { listWorkspaceAuditEvents } from "../../../../src/audit-runtime";
import { loadConnectionsPanelData } from "../../../../src/connections-panel-data";
import { listActiveOrganizationMembers } from "../../../../src/organization-actions";
import { listWorkspaceDomains } from "../../../../src/custom-domains/domain-actions";
import { getRequestBrand } from "../../../../src/custom-domains/runtime";
import { listWorkspaceSchedules } from "../../../../src/schedule-actions";
import { loadUsagePanelData } from "../../../../src/usage-overview";
import { canExportWorkspaceData } from "../../../../src/workspace-access";
import { WebSettingsPage } from "../../../../src/web-settings-page";
import { isSettingsSectionId } from "../../../../src/web-settings-sections";
import { listWebhookEndpoints } from "../../../../src/webhooks-actions";

type PageProps = Readonly<{
  params: Promise<{ locale: string; section: string }>;
  searchParams: Promise<{ status?: string }>;
}>;

export default async function LocaleSettingsSectionPage({ params, searchParams }: PageProps) {
  const { locale, section: raw } = await params;
  const { status } = await searchParams;
  if (!isAppLocale(locale) || !isSettingsSectionId(raw)) {
    notFound();
  }
  if (locale === "en") {
    redirect(`/settings/${raw}${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  }
  const serverConfig = parseServerConfig();
  const config = parsePublicConfig(serverConfig);
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
  const brand = await getRequestBrand();
  const domains = raw === "domains" ? await listWorkspaceDomains() : undefined;
  const connections =
    raw === "connections"
      ? await loadConnectionsPanelData({
          copy: dictionary.settings.sections.connections,
          locale,
        })
      : undefined;
  const usage = raw === "usage" ? await loadUsagePanelData() : undefined;
  const canExportWorkspace = raw === "general" ? await canExportWorkspaceData() : false;

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
