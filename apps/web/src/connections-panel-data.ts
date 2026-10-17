import "server-only";

import { parseServerConfig } from "@supastack/config";
import type { AppLocale, ConnectionsSectionCopy } from "@supastack/i18n";

import { listConnectedAccountsAction } from "./connected-accounts-actions";
import {
  OAUTH_PROVIDERS,
  type ConnectionsPanelData,
  type OAuthConnectedProvider,
} from "./connected-accounts";

/**
 * Shared connections-panel payload for both `settings/[section]` page
 * loaders (default-locale and `[locale]`). Keeps the accounts fetch, copy,
 * locale, and provider-availability map in one place so the two loaders
 * cannot drift apart.
 */
export async function loadConnectionsPanelData(input: {
  copy: ConnectionsSectionCopy;
  locale: AppLocale;
}): Promise<ConnectionsPanelData> {
  const serverConfig = parseServerConfig();
  const accounts = await listConnectedAccountsAction();
  return {
    ...accounts,
    copy: input.copy,
    enabledProviders: Object.fromEntries(
      OAUTH_PROVIDERS.map((provider) => [
        provider.id,
        serverConfig.connectedAccounts[provider.id].enabled,
      ]),
    ) as Record<OAuthConnectedProvider, boolean>,
    locale: input.locale,
  };
}
