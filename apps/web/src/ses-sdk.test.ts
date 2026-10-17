import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type * as SesSdk from "@aws-sdk/client-sesv2";
import { parseServerConfig } from "@supastack/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMarketingSend } from "./marketing/marketing-mail.js";
import { createServerTransactionalEmailSender } from "./server-provider-composition.js";

vi.mock("server-only", () => ({}));
const send = vi.hoisted(() =>
  vi
    .fn<(command: unknown) => Promise<{ MessageId: string }>>()
    .mockResolvedValue({ MessageId: "ses_offline_123" }),
);
vi.mock("@aws-sdk/client-sesv2", async (importOriginal) => ({
  ...(await importOriginal<typeof SesSdk>()),
  SESv2Client: vi.fn(function () {
    return { send };
  }),
}));

describe("SES SDK server sender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it.each([
    { name: "default AWS credential chain", env: {}, options: { region: "us-east-1" } },
    {
      name: "explicit IAM access keys",
      env: { AWS_ACCESS_KEY_ID: "sdk-key", AWS_SECRET_ACCESS_KEY: "sdk-secret" },
      options: {
        region: "us-east-1",
        credentials: { accessKeyId: "sdk-key", secretAccessKey: "sdk-secret" },
      },
    },
    {
      name: "temporary AWS credentials",
      env: {
        AWS_ACCESS_KEY_ID: "sdk-key",
        AWS_SECRET_ACCESS_KEY: "sdk-secret",
        AWS_SESSION_TOKEN: "sdk-token",
      },
      options: {
        region: "us-east-1",
        credentials: {
          accessKeyId: "sdk-key",
          secretAccessKey: "sdk-secret",
          sessionToken: "sdk-token",
        },
      },
    },
  ])("sends a workspace-scoped transaction with $name", async ({ env, options }) => {
    const config = parseServerConfig({
      EMAIL_PROVIDER: "ses",
      EMAIL_FROM: "App <hello@example.test>",
      ...env,
    });
    const sender = createServerTransactionalEmailSender(config.providers.email);
    expect(SESv2Client).toHaveBeenCalledWith(options);
    const delivery = await sender.send({
      category: "transactional",
      workspaceId: "workspace-a",
      to: "recipient@example.test",
      subject: "Your sign-in code",
      text: "123456",
    });
    expect(send).toHaveBeenCalledOnce();
    const command = send.mock.calls[0]?.[0] as SendEmailCommand | undefined;
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command?.input).toMatchObject({
      FromEmailAddress: "App <hello@example.test>",
      Destination: { ToAddresses: ["recipient@example.test"] },
      Content: {
        Simple: { Subject: { Data: "Your sign-in code" }, Body: { Text: { Data: "123456" } } },
      },
    });
    expect(delivery.id).toBe("ses_offline_123");
    expect(
      await sender.getStatus({ deliveryId: delivery.id, workspaceId: "workspace-a" }),
    ).toMatchObject({ status: "queued" });
    expect(
      await sender.getStatus({ deliveryId: delivery.id, workspaceId: "workspace-b" }),
    ).toBeUndefined();
  });
});

describe("SES SDK operator mail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it.each([false, true])(
    "keeps the separate operator sender working with temporary keys=%j",
    async (temporary) => {
      vi.clearAllMocks();
      vi.stubEnv("APP_ENV", "test");
      vi.stubEnv("EMAIL_PROVIDER", "ses");
      vi.stubEnv("AWS_REGION", "us-east-1");
      vi.stubEnv("AWS_ACCESS_KEY_ID", temporary ? "sdk-key" : "");
      vi.stubEnv("AWS_SECRET_ACCESS_KEY", temporary ? "sdk-secret" : "");
      vi.stubEnv("AWS_SESSION_TOKEN", temporary ? "sdk-token" : "");
      const deliver = createMarketingSend();
      expect(SESv2Client).toHaveBeenCalledWith(
        temporary
          ? {
              region: "us-east-1",
              credentials: {
                accessKeyId: "sdk-key",
                secretAccessKey: "sdk-secret",
                sessionToken: "sdk-token",
              },
            }
          : { region: "us-east-1" },
      );
      await deliver?.({
        to: "operator@example.test",
        subject: "Contact request",
        text: "A contact form submission",
      });
      expect(send).toHaveBeenCalledOnce();
      expect(send.mock.calls[0]?.[0]).toBeInstanceOf(SendEmailCommand);
    },
  );
});
