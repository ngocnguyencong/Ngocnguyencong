import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admission: vi.fn(async () => true),
  audit: vi.fn(async () => {}),
  captcha: vi.fn(async () => true),
  join: vi.fn(async () => ({ ok: true as const, outcome: "duplicate" as const })),
}));

vi.mock("@supastack/config", () => ({
  parseServerConfig: () => ({
    app: { webUrl: "https://app.example.test" },
    providers: { email: {} },
  }),
}));
vi.mock("@supastack/db", () => ({ AUDIT_ACTIONS: { waitlistJoined: "waitlist.joined" } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({}),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.8" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`redirect:${destination}`);
  },
}));
vi.mock("../admin-actions", () => ({ requireAdminSession: vi.fn() }));
vi.mock("../audit-runtime", () => ({ recordAuditEvent: mocks.audit }));
vi.mock("../auth-runtime", () => ({ database: {} }));
vi.mock("../captcha", () => ({ getCaptchaVerifier: () => ({ verify: mocks.captcha }) }));
vi.mock("../public-write-admission-runtime", () => ({
  marketingPublicWriteAllowed: mocks.admission,
}));
vi.mock("../server-provider-composition", () => ({
  createServerTransactionalEmailSender: () => ({ send: vi.fn() }),
}));
vi.mock("./growth-cookies", () => ({ readGrowthCookies: () => ({ ref: null }) }));
vi.mock("./growth-store", () => ({ createGrowthStore: () => ({}) }));
vi.mock("./waitlist-service", () => ({
  inviteWaitlistEntries: vi.fn(),
  issueEarlyAccessInvite: vi.fn(),
  joinWaitlist: mocks.join,
}));

import { joinWaitlistAction } from "./waitlist-actions";

function form(locale = "de"): FormData {
  const data = new FormData();
  data.set("email", "known@example.test");
  data.set("locale", locale);
  return data;
}

beforeEach(() => {
  mocks.admission.mockResolvedValue(true);
  mocks.audit.mockClear();
  mocks.captcha.mockResolvedValue(true);
  mocks.join.mockClear();
  mocks.join.mockResolvedValue({ ok: true, outcome: "duplicate" });
});

describe("joinWaitlistAction", () => {
  it("redirects duplicates without revealing rank or referral code", async () => {
    await expect(joinWaitlistAction(form())).rejects.toThrow(
      "redirect:/de?waitlist=duplicate#waitlist",
    );
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.join).toHaveBeenCalledTimes(1);
  });

  it("rejects public writes before joining when admission is exhausted", async () => {
    mocks.admission.mockResolvedValue(false);

    await expect(joinWaitlistAction(form())).rejects.toThrow(
      "redirect:/de?waitlist=rate-limited#waitlist",
    );
    expect(mocks.join).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
