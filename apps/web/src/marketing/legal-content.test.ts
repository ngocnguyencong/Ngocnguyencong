import { describe, expect, it } from "vitest";
import {
  acceptableUsePolicy,
  disclaimer,
  legalDocument,
  licenseAgreement,
  privacyPolicy,
  termsOfUse,
} from "./legal-content";

const forbidden = /SOC\s*2|ISO\s*27001|HIPAA|trusted by|1484|supastarter|GitHub seats/i;
/** Seller-site purchase mechanics stay out of the buyer-facing template. */
const sellerOnly = /\$\d+|stripe|license key|github invitation/i;

describe("legal documents", () => {
  it("exposes dated privacy, terms, license, acceptable-use, and disclaimer documents", () => {
    expect(privacyPolicy.slug).toBe("privacy");
    expect(privacyPolicy.title).toBe("Privacy");
    expect(privacyPolicy.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(privacyPolicy.sections.length).toBeGreaterThan(2);
    expect(termsOfUse.slug).toBe("terms");
    expect(termsOfUse.title).toBe("Terms");
    expect(licenseAgreement.slug).toBe("license");
    expect(licenseAgreement.title).toBe("License");
    expect(licenseAgreement.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(acceptableUsePolicy.slug).toBe("acceptable-use");
    expect(acceptableUsePolicy.title).toBe("Acceptable use");
    expect(disclaimer.slug).toBe("disclaimer");
    expect(disclaimer.title).toBe("Disclaimer");
    expect(legalDocument("privacy")).toBe(privacyPolicy);
    expect(legalDocument("terms")).toBe(termsOfUse);
    expect(legalDocument("license")).toBe(licenseAgreement);
    expect(legalDocument("acceptable-use")).toBe(acceptableUsePolicy);
    expect(legalDocument("disclaimer")).toBe(disclaimer);
  });

  it("describes real collection and billing facts without invented proof", () => {
    const privacy = JSON.stringify(privacyPolicy);
    const terms = JSON.stringify(termsOfUse);
    const license = JSON.stringify(licenseAgreement);
    expect(privacy).toMatch(/workspace/i);
    expect(privacy).toMatch(/email/i);
    expect(terms).toMatch(/payment provider/i);
    expect(privacy).not.toMatch(forbidden);
    expect(terms).not.toMatch(forbidden);
    expect(license).not.toMatch(forbidden);
    expect(JSON.stringify(acceptableUsePolicy)).not.toMatch(forbidden);
    expect(JSON.stringify(disclaimer)).not.toMatch(forbidden);
  });

  it("states the license grant, its limits, and the seat rule without seller mechanics", () => {
    const license = JSON.stringify(licenseAgreement);
    expect(license).toMatch(/non-exclusive/i);
    expect(license).toMatch(/redistribut/i);
    expect(license).toMatch(/seat/i);
    expect(license).not.toMatch(sellerOnly);
    const listed = licenseAgreement.sections.filter((section) => section.items);
    expect(listed.length).toBeGreaterThanOrEqual(2);
    for (const section of licenseAgreement.sections) {
      expect(section.heading.trim()).not.toBe("");
      expect(section.body.trim()).not.toBe("");
      for (const item of section.items ?? []) {
        expect(item.trim()).not.toBe("");
      }
    }
  });

  it("states acceptable-use rules and disclaimer limits without seller mechanics", () => {
    const aup = JSON.stringify(acceptableUsePolicy);
    expect(aup).toMatch(/prohibited activity/i);
    expect(aup).toMatch(/spam/i);
    expect(aup).not.toMatch(sellerOnly);
    const disc = JSON.stringify(disclaimer);
    expect(disc).toMatch(/professional advice/i);
    expect(disc).toMatch(/as is/i);
    expect(disc).not.toMatch(sellerOnly);
    const prohibited = acceptableUsePolicy.sections.find((section) => section.items);
    expect(prohibited?.items?.length).toBeGreaterThanOrEqual(4);
    for (const document of [acceptableUsePolicy, disclaimer]) {
      for (const section of document.sections) {
        expect(section.heading.trim()).not.toBe("");
        expect(section.body.trim()).not.toBe("");
        for (const item of section.items ?? []) {
          expect(item.trim()).not.toBe("");
        }
      }
    }
  });

  it("describes native purchase policy with the current RevenueCat verification flow", () => {
    const accountTerms = termsOfUse.sections.find((section) => section.heading === "Accounts");
    expect(accountTerms?.body).toMatch(/native mobile purchases and restores use RevenueCat/i);
    expect(accountTerms?.body).toMatch(/workspace access follows server-verified entitlements/i);
    expect(accountTerms?.body).toMatch(/web billing is separate/i);
    expect(accountTerms?.body).not.toMatch(/until RevenueCat exists/i);
  });
});
