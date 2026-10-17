import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  getDictionary,
  isAppLocale,
  localePath,
  resolveLocale,
  stripLocalePrefix,
  SUPPORTED_LOCALES,
} from "./index.js";

describe("@supastack/i18n", () => {
  it("provides neutral landing copy without a customer-proof dictionary in every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const dictionary = getDictionary(locale);
      expect(dictionary).not.toHaveProperty("marketingTestimonials");
      const copy = dictionary.marketingLanding;
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.description).toMatch(/demo|démo/i);
      expect(copy.primaryAction.length).toBeGreaterThan(0);
      expect(copy.metadataTitle).toMatch(/demo|démo/i);
      expect(copy.metadataDescription.length).toBeGreaterThan(0);
    }
  });

  it("exposes demo-parity locales with English default", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "de", "es", "fr"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(isAppLocale("de")).toBe(true);
    expect(isAppLocale("pt")).toBe(false);
  });

  it("resolves locale from cookie, path, then Accept-Language style candidates", () => {
    expect(resolveLocale(["de", "en"])).toBe("de");
    expect(resolveLocale([null, "fr-FR,fr;q=0.9"])).toBe("fr");
    expect(resolveLocale(["xx", undefined])).toBe("en");
  });

  it("builds locale-prefixed paths without duplicating the English default", () => {
    expect(localePath("en", "/")).toBe("/");
    expect(localePath("de", "/")).toBe("/de");
    expect(localePath("es", "/pricing")).toBe("/es/pricing");
  });

  it("strips a leading locale segment when present", () => {
    expect(stripLocalePrefix("/de")).toEqual({ locale: "de", pathname: "/" });
    expect(stripLocalePrefix("/fr/blog")).toEqual({ locale: "fr", pathname: "/blog" });
    expect(stripLocalePrefix("/docs")).toEqual({ locale: null, pathname: "/docs" });
  });

  it("returns translated invite mail and notification chrome for each locale", () => {
    expect(getDictionary("en").mail.inviteSubject).toMatch(/invited/i);
    expect(getDictionary("de").notifications.title).toBe("Benachrichtigungen");
    expect(getDictionary("es").nav.getAccess).toBe("Comenzar");
    expect(getDictionary("fr").mail.inviteBody("Acme", "https://example.test/invite/x")).toContain(
      "Acme",
    );
  });

  it("covers settings, org chrome, auth mail, and notification event copy per locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const copy = getDictionary(locale);
      expect(copy.settings.title.length).toBeGreaterThan(0);
      expect(copy.settings.sections.members.label.length).toBeGreaterThan(0);
      const connections = copy.settings.sections.connections;
      expect(connections.label.length).toBeGreaterThan(0);
      expect(connections.description.length).toBeGreaterThan(0);
      expect(connections.panel.connectProvider).toContain("{provider}");
      expect(connections.panel.notConfigured).toContain("{envVar}");
      expect(connections.panel.lastRefreshed).toContain("{date}");
      expect(connections.panel.smtpAdd.length).toBeGreaterThan(0);
      expect(connections.panel.flashDenied.length).toBeGreaterThan(0);
      expect(copy.org.settingsTitle.length).toBeGreaterThan(0);
      expect(copy.org.dangerZone.length).toBeGreaterThan(0);
      expect(copy.org.leave.length).toBeGreaterThan(0);
      expect(copy.mail.magicLinkSubject.length).toBeGreaterThan(0);
      expect(copy.mail.otpSignInSubject.length).toBeGreaterThan(0);
      expect(copy.mail.aiCompleteSubject.length).toBeGreaterThan(0);
      expect(copy.mail.transactionalFooter.length).toBeGreaterThan(0);
      expect(copy.common.dismiss.length).toBeGreaterThan(0);
      expect(copy.notificationEvents.inviteAccepted.title.length).toBeGreaterThan(0);
      expect(copy.notificationEvents.memberLeft.body("alex@example.com")).toContain("alex@");
      expect(copy.notificationEvents.memberRemoved.body("alex@example.com")).toContain("alex@");
      expect(copy.notificationEvents.memberRoleChanged.body("alex@example.com", "admin")).toContain(
        "admin",
      );
    }
    expect(getDictionary("de").settings.sections.billing.label).toMatch(/Abrechnung|Billing/i);
    expect(getDictionary("fr").mail.magicLinkBody("https://example.test/link")).toContain(
      "https://example.test/link",
    );
  });
});
