import { describe, expect, it } from "vitest";
import { docTabs, guides } from "./content";
import { guideContinuation, guideSetupFlow } from "./docs-continuation";
import { DOCS_COPY } from "./docs-copy";
import { docsHref, localizedGuides, missingDocTranslations } from "./docs-i18n";
import coreSource from "./translations/core.en.json";
import coreDe from "./translations/core.de.json";
import coreEs from "./translations/core.es.json";
import coreFr from "./translations/core.fr.json";

describe("guided setup and documentation locales", () => {
  it("keeps shell commands executable in translated instructions", () => {
    const commands = new Set([
      "npm install --global corepack",
      "corepack.cmd pnpm install",
      "corepack enable",
      ...guides.flatMap((guide) =>
        guide.sections.flatMap((section) =>
          (section.code ?? "")
            .split("\n")
            .filter(
              (line) => /^(corepack pnpm |npm install |eas )/.test(line) && !line.includes("→"),
            ),
        ),
      ),
    ]);
    for (const locale of ["de", "es", "fr"] as const) {
      const translatedGuides = localizedGuides(locale);
      guides.forEach((guide, guideIndex) => {
        guide.sections.forEach((section, sectionIndex) => {
          const source = [...section.paragraphs, ...(section.items ?? [])].join("\n");
          const translated = translatedGuides[guideIndex]!.sections[sectionIndex]!;
          for (const command of commands) {
            if (source.includes(command)) {
              expect(
                [...translated.paragraphs, ...(translated.items ?? [])].join("\n"),
                `${locale}/${guide.slug}#${section.id}: ${command}`,
              ).toContain(command);
            }
          }
        });
      });
    }
  });

  it("treats source-file list entries as stable identifiers", () => {
    for (const locale of ["de", "es", "fr"] as const) {
      expect(missingDocTranslations(locale)).not.toContain(
        "apps/web/src/kit/blocks/marketing/hero-centered.tsx",
      );
      const original = guides.find((guide) => guide.slug === "components/hero-centered")!;
      const translated = localizedGuides(locale).find((guide) => guide.slug === original.slug)!;
      expect(translated.sections.find((section) => section.id === "files")?.items).toEqual(
        original.sections.find((section) => section.id === "files")?.items,
      );
    }
  });

  it("keeps every core translation aligned with the English content snapshot", () => {
    for (const translated of [coreDe, coreEs, coreFr]) {
      expect(translated).toHaveLength(coreSource.length);
      expect(translated.every((text) => text.trim().length > 0)).toBe(true);
    }
  });

  it("gives every guide a real, deliberate continuation destination", () => {
    for (const guide of guides) {
      const next = guideContinuation(guide, guides);
      expect(next, guide.slug).toBeDefined();
      expect(next?.slug, guide.slug).not.toBe(guide.slug);
    }
    const find = (slug: string) => guides.find((guide) => guide.slug === slug)!;
    expect(guideContinuation(find("web/local-setup"), guides)?.slug).toBe("web/project-structure");
    expect(guideContinuation(find("web/project-structure"), guides)?.slug).toBe(
      "web/configuration",
    );
    expect(guideSetupFlow(find("web/local-setup"), guides)?.guide.slug).toBe("web/database");
    expect(guideContinuation(find("mobile/local-setup"), guides)?.slug).toBe(
      "mobile/authentication",
    );
    expect(guideContinuation(find("desktop/local-setup"), guides)?.slug).toBe(
      "desktop/native-behavior",
    );
    expect(guideContinuation(find("web/database"), guides)?.slug).toBe("deploy/supabase-cloud");
    expect(guideSetupFlow(find("web/database"), guides)?.guide.slug).toBe(
      "modules/billing-configuration",
    );
    for (const guide of guides) {
      if (guide.setupFlowTo) {
        const setup = guideSetupFlow(guide, guides);
        expect(setup?.guide.slug, guide.slug).toBe(guide.setupFlowTo);
        expect(setup?.guide.slug, guide.slug).not.toBe(guide.slug);
      }
    }
  });

  it("puts the five-minute first-run tutorial first in each platform surface", () => {
    expect(docTabs.map((tab) => tab.slug)).toContain("desktop");
    for (const tab of ["web", "mobile", "desktop"] as const) {
      const first = guides.find((guide) => guide.tab === tab);
      expect(first?.slug, tab).toBe(`${tab}/local-setup`);
      expect(first?.title, tab).toMatch(/5 minutes/i);
    }
    for (const copy of Object.values(DOCS_COPY)) {
      expect(copy.next.length).toBeGreaterThan(0);
      expect(copy.setupSentence).toContain("{guide}");
    }
  });

  it("continues reference and feature guides to a specific next article", () => {
    expect(
      guides.filter((guide) => guide.continueTo === "reference/guides").map((guide) => guide.slug),
    ).toEqual([]);
  });

  it("preserves identifiers and code while translating readable content", () => {
    for (const locale of ["de", "es", "fr"] as const) {
      const localized = localizedGuides(locale);
      expect(localized).toHaveLength(guides.length);
      for (const original of guides) {
        const translated = localized.find((guide) => guide.slug === original.slug)!;
        expect(translated.continueTo).toBe(original.continueTo);
        expect(translated.sections.map((section) => [section.id, section.code])).toEqual(
          original.sections.map((section) => [section.id, section.code]),
        );
        original.sections.forEach((section, index) => {
          const sourceText = [...section.paragraphs, ...(section.items ?? [])].join("\n");
          const translatedSection = translated.sections[index]!;
          const translatedText = [
            ...translatedSection.paragraphs,
            ...(translatedSection.items ?? []),
          ].join("\n");
          for (const token of sourceText.matchAll(/`([^`]+)`/g)) {
            expect(translatedText, `${locale}/${original.slug}#${section.id}`).toContain(token[1]);
          }
          for (const link of sourceText.matchAll(/\]\((\/docs[^)]+|https:\/\/[^)]+)\)/g)) {
            expect(translatedText, `${locale}/${original.slug}#${section.id}`).toContain(link[1]);
          }
        });
      }
      expect(localized.find((guide) => guide.slug === "web/local-setup")?.title).not.toBe(
        guides.find((guide) => guide.slug === "web/local-setup")?.title,
      );
      expect(missingDocTranslations(locale)).toEqual([]);
    }
  });

  it("preserves locale, anchors and queries in documentation links", () => {
    expect(docsHref("de", "/docs/web/database#setup")).toBe("/de/docs/web/database#setup");
    expect(docsHref("fr", "/docs?q=SMTP_PORT")).toBe("/fr/docs?q=SMTP_PORT");
    expect(docsHref("en", "/docs/mobile")).toBe("/docs/mobile");
    expect(docsHref("es", "#setup")).toBe("#setup");
    expect(docsHref("de", "https://example.com/docs")).toBe("https://example.com/docs");
  });

  it("provides translated continuation and search labels for all supported languages", () => {
    for (const copy of Object.values(DOCS_COPY)) {
      expect(Object.keys(copy).sort()).toEqual(Object.keys(DOCS_COPY.en).sort());
      expect(copy.continueSetup.length).toBeGreaterThan(0);
      expect(copy.searchDocumentation.length).toBeGreaterThan(0);
    }
  });
});
