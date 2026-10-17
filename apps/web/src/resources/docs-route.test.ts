import { describe, expect, it } from "vitest";
import { docsMetadata, docsPageData } from "./docs-route";

describe("documentation route metadata", () => {
  it("uses the actual localized landing and guide canonical paths", () => {
    expect(docsMetadata("de").alternates?.canonical).toBe("/de/docs");
    const metadata = docsMetadata("fr", ["web", "database"]);
    expect(metadata.alternates?.canonical).toBe("/fr/docs/web/database");
    expect(metadata.alternates?.languages).toEqual({
      en: "/docs/web/database",
      de: "/de/docs/web/database",
      es: "/es/docs/web/database",
      fr: "/fr/docs/web/database",
      "x-default": "/docs/web/database",
    });
  });

  it("collapses all search variants and their language alternates to the landing page", () => {
    const metadata = docsMetadata("es", ["web", "database"], "  SMTP_PORT  ");
    expect(metadata.alternates?.canonical).toBe("/es/docs");
    expect(metadata.alternates?.languages).toEqual({
      en: "/docs",
      de: "/de/docs",
      es: "/es/docs",
      fr: "/fr/docs",
      "x-default": "/docs",
    });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("does not index missing guides and safely normalizes search inputs", () => {
    expect(docsMetadata("en", ["missing"]).robots).toEqual({
      index: false,
      follow: true,
    });
    expect(docsPageData("en", undefined, ["unexpected", "array"]).query).toBe("");
    expect(docsPageData("en", undefined, "   ").query).toBe("");
    expect(docsPageData("en", undefined, "x".repeat(250)).query).toHaveLength(200);
  });
});
