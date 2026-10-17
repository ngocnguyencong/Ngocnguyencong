import { createEmailClient } from "@opencoredev/email-sdk";
import { memoryAdapter } from "@opencoredev/email-sdk/testing";
import { describe, expect, it } from "vitest";

import { EmailSdkTransactionalEmailSender, type EmailSdkSendClient } from "./email-sdk";
import { OutreachEmailRejectedError, TransactionalEmailDeliveryError } from "./index";

function captureClient() {
  const memory = memoryAdapter();
  // Telemetry is disabled in every composition path — the production factories
  // pass the same `telemetry: false` this test client does.
  const client = createEmailClient({ adapters: [memory], telemetry: false });
  return { client, memory };
}

describe("EmailSdkTransactionalEmailSender", () => {
  it("sends a transactional message through the email-sdk client", async () => {
    const { client, memory } = captureClient();
    const sender = new EmailSdkTransactionalEmailSender(
      client as EmailSdkSendClient,
      "supastack <hello@example.test>",
      "postmark",
    );

    const delivery = await sender.send({
      category: "transactional",
      subject: "Your sign-in link",
      text: "Open https://app.test/login",
      to: "user@example.test",
      workspaceId: "workspace_01",
      html: "<p>hi</p>",
    });

    expect(delivery.id).toBe("mem_1");
    expect(delivery.status).toBe("queued");
    expect(memory.raw.sent).toHaveLength(1);
    expect(memory.raw.sent[0]?.message).toMatchObject({
      from: "supastack <hello@example.test>",
      html: "<p>hi</p>",
      subject: "Your sign-in link",
      text: "Open https://app.test/login",
    });
  });

  it("rejects outreach email exactly like the other transactional senders", async () => {
    const { client } = captureClient();
    const sender = new EmailSdkTransactionalEmailSender(
      client as EmailSdkSendClient,
      "supastack <hello@example.test>",
      "sendgrid",
    );

    await expect(
      sender.send({
        category: "outreach",
        subject: "Campaign",
        text: "hello",
        to: "user@example.test",
        workspaceId: "workspace_01",
      }),
    ).rejects.toBeInstanceOf(OutreachEmailRejectedError);
  });

  it("throws the shared delivery error when no delivery id is returned", async () => {
    const sender = new EmailSdkTransactionalEmailSender(
      {
        async send() {
          return {};
        },
      },
      "supastack <hello@example.test>",
      "smtp",
    );

    await expect(
      sender.send({
        category: "transactional",
        subject: "Hi",
        text: "hello",
        to: "user@example.test",
        workspaceId: "workspace_01",
      }),
    ).rejects.toBeInstanceOf(TransactionalEmailDeliveryError);
  });

  it("scopes getStatus to the owning workspace", async () => {
    const { client } = captureClient();
    const sender = new EmailSdkTransactionalEmailSender(
      client as EmailSdkSendClient,
      "supastack <hello@example.test>",
      "brevo",
    );

    const delivery = await sender.send({
      category: "transactional",
      subject: "Hi",
      text: "hello",
      to: "user@example.test",
      workspaceId: "workspace_01",
    });

    await expect(
      sender.getStatus({ deliveryId: delivery.id, workspaceId: "workspace_01" }),
    ).resolves.toEqual({ id: delivery.id, workspaceId: "workspace_01", status: "queued" });
    await expect(
      sender.getStatus({ deliveryId: delivery.id, workspaceId: "workspace_02" }),
    ).resolves.toBeUndefined();
  });
});
