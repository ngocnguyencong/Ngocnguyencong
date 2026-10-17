import type { AppLocale } from "@supastack/i18n";
import { getDictionary, localePath } from "@supastack/i18n";

export type SettingsSectionId =
  | "general"
  | "appearance"
  | "security"
  | "billing"
  | "usage"
  | "members"
  | "notifications"
  | "developers"
  | "connections"
  | "domains"
  | "audit";

export type SettingsSection = Readonly<{
  id: SettingsSectionId;
  label: string;
  description: string;
  href: string;
}>;

const SECTION_HREFS: Readonly<Record<SettingsSectionId, string>> = Object.freeze({
  general: "/settings/general",
  appearance: "/settings/appearance",
  security: "/settings/security",
  billing: "/settings/billing",
  usage: "/settings/usage",
  members: "/settings/members",
  notifications: "/settings/notifications",
  developers: "/settings/developers",
  connections: "/settings/connections",
  domains: "/settings/domains",
  audit: "/settings/audit",
});

export function localizedSettingsSections(locale: AppLocale = "en"): readonly SettingsSection[] {
  const sections = getDictionary(locale).settings.sections;
  return Object.freeze(
    (Object.keys(SECTION_HREFS) as SettingsSectionId[]).map((id) =>
      Object.freeze({
        id,
        href: localePath(locale, SECTION_HREFS[id]),
        label: sections[id].label,
        description: sections[id].description,
      }),
    ),
  );
}

/** English control-plane IA used by route allowlists and default UI. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = localizedSettingsSections("en");

export function isSettingsSectionId(value: string | undefined | null): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

export function parseSettingsSection(value: string | undefined | null): SettingsSectionId {
  return isSettingsSectionId(value) ? value : "general";
}

export function getSettingsSection(
  id: SettingsSectionId,
  locale: AppLocale = "en",
): SettingsSection {
  const section = localizedSettingsSections(locale).find((entry) => entry.id === id);
  if (section === undefined) {
    throw new Error("Unknown settings section.");
  }
  return section;
}
