import type { AppLocale } from "@supastack/i18n";
import { guides, type Guide, type Section } from "./content";
import { docsHref } from "./docs-copy";
export { docsHref } from "./docs-copy";
import coreSource from "./translations/core.en.json";
import coreDe from "./translations/core.de.json";
import coreEs from "./translations/core.es.json";
import coreFr from "./translations/core.fr.json";
import providersDe from "./translations/providers.de.json";
import providersEs from "./translations/providers.es.json";
import providersFr from "./translations/providers.fr.json";
import blocksDe from "./translations/blocks.de.json";
import blocksEs from "./translations/blocks.es.json";
import blocksFr from "./translations/blocks.fr.json";
import referenceDe from "./translations/reference.de.json";
import referenceEs from "./translations/reference.es.json";
import referenceFr from "./translations/reference.fr.json";
import beginnersDe from "./translations/beginners.de.json";
import beginnersEs from "./translations/beginners.es.json";
import beginnersFr from "./translations/beginners.fr.json";

type TranslationMap = Readonly<Record<string, string>>;
const coreMap = (translated: readonly string[]): TranslationMap =>
  Object.fromEntries(
    coreSource.flatMap((source, index) => {
      const value = translated[index];
      return value ? [[source, value]] : [];
    }),
  );
const dictionaries: Record<Exclude<AppLocale, "en">, TranslationMap> = {
  de: { ...coreMap(coreDe), ...providersDe, ...blocksDe, ...referenceDe, ...beginnersDe },
  es: { ...coreMap(coreEs), ...providersEs, ...blocksEs, ...referenceEs, ...beginnersEs },
  fr: { ...coreMap(coreFr), ...providersFr, ...blocksFr, ...referenceFr, ...beginnersFr },
};

export function localizeDocText(locale: AppLocale, text: string): string {
  return locale === "en" ? text : (dictionaries[locale][text] ?? text);
}

function localizedSection(section: Section, locale: AppLocale): Section {
  const t = (text: string) => localizeDocText(locale, text);
  return {
    ...section,
    title: t(section.title),
    paragraphs: section.paragraphs.map(t),
    ...(section.items ? { items: section.items.map(t) } : {}),
    ...(section.table
      ? {
          table: {
            ...section.table,
            head: section.table.head.map(t),
            rows: section.table.rows.map((row) => row.map(t)),
          },
        }
      : {}),
    ...(section.links
      ? {
          links: section.links.map((link) => ({
            ...link,
            href: docsHref(locale, link.href),
            label: t(link.label),
            ...(link.description ? { description: t(link.description) } : {}),
          })),
        }
      : {}),
  };
}

export function localizedGuides(locale: AppLocale): readonly Guide[] {
  if (locale === "en") return guides;
  return guides.map((guide) => ({
    ...guide,
    title: localizeDocText(locale, guide.title),
    description: localizeDocText(locale, guide.description),
    group: localizeDocText(locale, guide.group),
    sections: guide.sections.map((section) => localizedSection(section, locale)),
  }));
}

/** Exact content coverage check; technical table identifiers may remain unchanged. */
export function missingDocTranslations(locale: Exclude<AppLocale, "en">): string[] {
  const source = new Set<string>();
  for (const guide of guides) {
    [guide.title, guide.description, guide.group].forEach((text) => source.add(text));
    for (const section of guide.sections) {
      [section.title, ...section.paragraphs, ...(section.items ?? [])].forEach((text) =>
        source.add(text),
      );
      for (const link of section.links ?? []) {
        source.add(link.label);
        if (link.description) source.add(link.description);
      }
      if (section.table) {
        for (const text of [...section.table.head, ...section.table.rows.flat()]) {
          if (/[a-z]{2,}\s+[a-z]{2,}/i.test(text)) source.add(text);
        }
      }
    }
  }
  return [...source].filter(
    (text) =>
      text &&
      !/^(?:\.ai\/)?(?:apps|packages|docs|prompts|scripts)\/\S+$/.test(text) &&
      !dictionaries[locale][text],
  );
}
