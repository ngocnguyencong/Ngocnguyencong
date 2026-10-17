import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("mail preview route", () => {
  it("is gated to local email outside production", () => {
    const source = readFileSync(join(webRoot, "app/mail-preview/page.tsx"), "utf8");
    expect(source).toContain('config.providers.email.kind !== "local"');
    expect(source).toContain('config.app.environment === "production"');
    expect(source).toContain("listDeliveries");
    expect(source).toContain("TRANSACTIONAL_MAIL_TEMPLATE_PREVIEWS");
    expect(source).toContain("Outreach templates are intentionally excluded");
  });
});
