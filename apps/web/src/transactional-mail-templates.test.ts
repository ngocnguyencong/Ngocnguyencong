import { describe, expect, it } from "vitest";

import { TRANSACTIONAL_MAIL_TEMPLATE_PREVIEWS } from "./transactional-mail-templates.js";

describe("transactional mail template previews", () => {
  it("lists only transactional product templates", () => {
    expect(TRANSACTIONAL_MAIL_TEMPLATE_PREVIEWS.length).toBeGreaterThanOrEqual(5);
    expect(
      TRANSACTIONAL_MAIL_TEMPLATE_PREVIEWS.every((entry) => entry.category === "transactional"),
    ).toBe(true);
    expect(TRANSACTIONAL_MAIL_TEMPLATE_PREVIEWS.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "auth-otp",
        "auth-magic-link",
        "workspace-invite",
        "early-access-invite",
        "ai-task-complete",
        "billing-payment-failed",
      ]),
    );
  });
});
