import { expect, it } from "vitest";
import { getDictionary } from "@supastack/i18n";

import {
  createAuthMailAdmission,
  createAuthMagicLinkDelivery,
  createAuthOtpDelivery,
} from "./auth-otp-delivery.js";
import { createRateLimiter } from "./rate-limit.js";

it("maps Better Auth OTP messages to the transactional pre-auth delivery boundary", async () => {
  const messages: unknown[] = [];
  const deliver = createAuthOtpDelivery({
    async getStatus() {
      return undefined;
    },
    async send(message) {
      messages.push(message);
      return {
        ...message,
        id: "delivery_1",
        status: "queued" as const,
      };
    },
  });

  await deliver({ email: "person@example.com", otp: "123456", type: "sign-in" });
  await deliver({ email: "person@example.com", otp: "654321", type: "forget-password" });

  const enMail = getDictionary("en").mail;
  expect(messages).toEqual([
    {
      category: "transactional",
      footer: enMail.transactionalFooter,
      lang: "en",
      subject: "Your supastack sign-in code",
      text: "Your sign-in code is 123456",
      to: "person@example.com",
      workspaceId: "pre-auth",
    },
    {
      category: "transactional",
      footer: enMail.transactionalFooter,
      lang: "en",
      subject: "Your supastack password reset code",
      text: "Your password reset code is 654321",
      to: "person@example.com",
      workspaceId: "pre-auth",
    },
  ]);
});

it("maps Better Auth magic-link messages to the transactional pre-auth delivery boundary", async () => {
  const messages: unknown[] = [];
  const deliver = createAuthMagicLinkDelivery({
    async getStatus() {
      return undefined;
    },
    async send(message) {
      messages.push(message);
      return {
        ...message,
        id: "delivery_2",
        status: "queued" as const,
      };
    },
  });

  await deliver({
    email: "person@example.com",
    token: "secret-token",
    url: "https://api.example.com/api/auth/magic-link/verify?token=secret-token&callbackURL=%2Fdashboard",
  });

  expect(messages).toEqual([
    {
      category: "transactional",
      footer: getDictionary("en").mail.transactionalFooter,
      lang: "en",
      subject: "Your supastack sign-in link",
      text: "Open this link to sign in: https://api.example.com/api/auth/magic-link/verify?token=secret-token&callbackURL=%2Fdashboard",
      to: "person@example.com",
      workspaceId: "pre-auth",
    },
  ]);
});

it("localizes magic-link copy when a non-English locale is supplied", async () => {
  const messages: unknown[] = [];
  const deliver = createAuthMagicLinkDelivery(
    {
      async getStatus() {
        return undefined;
      },
      async send(message) {
        messages.push(message);
        return {
          ...message,
          id: "delivery_3",
          status: "queued" as const,
        };
      },
    },
    { locale: "de" },
  );

  await deliver({
    email: "person@example.com",
    token: "secret-token",
    url: "https://example.test/magic",
  });

  expect(messages).toEqual([
    {
      category: "transactional",
      footer: getDictionary("de").mail.transactionalFooter,
      lang: "de",
      subject: getDictionary("de").mail.magicLinkSubject,
      text: getDictionary("de").mail.magicLinkBody("https://example.test/magic"),
      to: "person@example.com",
      workspaceId: "pre-auth",
    },
  ]);
});

it("admits five OTP and magic-link sends per recipient before invoking delivery", async () => {
  const messages: Array<{ to: string }> = [];
  const sender = {
    async getStatus() {
      return undefined;
    },
    async send(message: { to: string }) {
      messages.push(message);
      return {
        ...message,
        id: `delivery_${messages.length}`,
        status: "queued" as const,
        subject: "test",
        text: "test",
        workspaceId: "pre-auth",
      };
    },
  };
  const mailLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
  const admitAuthMail = createAuthMailAdmission("auth-mail-test-key", { mailLimiter });
  const deliverOtp = createAuthOtpDelivery(sender);
  const deliverLink = createAuthMagicLinkDelivery(sender);
  const sendWhenAdmitted = async (email: string, deliver: () => Promise<void>) => {
    const admitted = await admitAuthMail(email);
    if (admitted) await deliver();
    return admitted;
  };

  const decisions = [
    await sendWhenAdmitted("victim@example.com", () =>
      deliverOtp({ email: "victim@example.com", otp: "111111", type: "sign-in" }),
    ),
    await sendWhenAdmitted("VICTIM@example.com", () =>
      deliverLink({ email: "VICTIM@example.com", token: "token", url: "https://example.test/a" }),
    ),
    await sendWhenAdmitted("victim@example.com", () =>
      deliverOtp({ email: "victim@example.com", otp: "222222", type: "sign-in" }),
    ),
    await sendWhenAdmitted("victim@example.com", () =>
      deliverOtp({ email: "victim@example.com", otp: "333333", type: "sign-in" }),
    ),
    await sendWhenAdmitted("victim@example.com", () =>
      deliverOtp({ email: "victim@example.com", otp: "444444", type: "sign-in" }),
    ),
    await sendWhenAdmitted("victim@example.com", () =>
      deliverLink({ email: "victim@example.com", token: "token", url: "https://example.test/b" }),
    ),
    await sendWhenAdmitted("other@example.com", () =>
      deliverOtp({ email: "other@example.com", otp: "555555", type: "sign-in" }),
    ),
  ];

  expect(decisions).toEqual([true, true, true, true, true, false, true]);
  expect(messages.map((message) => message.to)).toEqual([
    "victim@example.com",
    "VICTIM@example.com",
    "victim@example.com",
    "victim@example.com",
    "victim@example.com",
    "other@example.com",
  ]);
});
