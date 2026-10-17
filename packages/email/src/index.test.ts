import { describe, expect, test, vi } from "vitest";

type EmailApi = {
  EmailDeliveryStatusStore: new (options?: {
    maxEntries?: number;
    now?: () => number;
    ttlMs?: number;
  }) => {
    get(input: {
      workspaceId: string;
      deliveryId: string;
    }): { id: string; workspaceId: string; status: "queued" } | undefined;
    record(delivery: {
      id: string;
      workspaceId: string;
      to: string;
      subject: string;
      text: string;
      status: "queued";
    }): void;
  };
  LocalOutboxEmailSender: new (options?: {
    maxEntries?: number;
    now?: () => number;
    ttlMs?: number;
  }) => {
    send(input: {
      workspaceId: string;
      to: string;
      subject: string;
      text: string;
      category: "transactional" | "outreach";
    }): Promise<{ id: string; workspaceId: string; status: "queued" }>;
    getStatus(input: {
      workspaceId: string;
      deliveryId: string;
    }): Promise<{ id: string; workspaceId: string; status: "queued" } | undefined>;
    listDeliveries(workspaceId?: string): readonly {
      id: string;
      workspaceId: string;
      to: string;
      subject: string;
      text: string;
      status: "queued";
    }[];
  };
  getSharedLocalOutboxEmailSender: () => InstanceType<EmailApi["LocalOutboxEmailSender"]>;
  HtmlTemplatedEmailSender: new (inner: InstanceType<EmailApi["LocalOutboxEmailSender"]>) => {
    send(input: {
      workspaceId: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
      lang?: string;
      footer?: string;
      category: "transactional";
    }): Promise<{ id: string; workspaceId: string; status: "queued"; html?: string }>;
    getStatus(input: {
      workspaceId: string;
      deliveryId: string;
    }): Promise<{ id: string; workspaceId: string; status: "queued" } | undefined>;
  };
  OutreachEmailRejectedError: new () => Error;
  ResendTransactionalEmailSender: new (
    client: {
      emails: {
        send(input: {
          from: string;
          to: string[];
          subject: string;
          text: string;
        }): Promise<{ data: { id: string } | null; error: unknown | null }>;
      };
    },
    from: string,
  ) => {
    send(input: {
      workspaceId: string;
      to: string;
      subject: string;
      text: string;
      category: "transactional" | "outreach";
    }): Promise<{ id: string; workspaceId: string; status: "queued" }>;
    getStatus(input: {
      workspaceId: string;
      deliveryId: string;
    }): Promise<{ id: string; workspaceId: string; status: "queued" } | undefined>;
  };
  SesTransactionalEmailSender: new (
    client: {
      createSendEmailCommand(input: {
        FromEmailAddress: string;
        Destination: { ToAddresses: string[] };
        Content: {
          Simple: {
            Subject: { Data: string; Charset: "UTF-8" };
            Body: { Text: { Data: string; Charset: "UTF-8" } };
          };
        };
      }): unknown;
      send(command: unknown): Promise<{ MessageId?: string }>;
    },
    from: string,
  ) => {
    send(input: {
      workspaceId: string;
      to: string;
      subject: string;
      text: string;
      category: "transactional" | "outreach";
    }): Promise<{ id: string; workspaceId: string; status: "queued" }>;
    getStatus(input: {
      workspaceId: string;
      deliveryId: string;
    }): Promise<{ id: string; workspaceId: string; status: "queued" } | undefined>;
  };
};

const emailApi = (await import("./index.js").catch(() => undefined)) as
  Partial<EmailApi> | undefined;

function createEmailSender(): InstanceType<EmailApi["LocalOutboxEmailSender"]> {
  expect(emailApi).toBeDefined();
  expect(emailApi).toHaveProperty("LocalOutboxEmailSender");
  return new emailApi!.LocalOutboxEmailSender!();
}

function createResendSender(
  client: ConstructorParameters<EmailApi["ResendTransactionalEmailSender"]>[0],
): InstanceType<EmailApi["ResendTransactionalEmailSender"]> {
  expect(emailApi).toBeDefined();
  expect(emailApi).toHaveProperty("ResendTransactionalEmailSender");
  return new emailApi!.ResendTransactionalEmailSender!(client, "supastack <noreply@example.com>");
}

function createSesSender(
  client: ConstructorParameters<EmailApi["SesTransactionalEmailSender"]>[0],
): InstanceType<EmailApi["SesTransactionalEmailSender"]> {
  expect(emailApi).toBeDefined();
  expect(emailApi).toHaveProperty("SesTransactionalEmailSender");
  return new emailApi!.SesTransactionalEmailSender!(client, "noreply@example.com");
}

describe("LocalOutboxEmailSender", () => {
  test("records a transactional email as a queued delivery", async () => {
    const sender = createEmailSender();

    const delivery = await sender.send({
      workspaceId: "workspace-a",
      to: "owner@example.com",
      subject: "Your task is complete",
      text: "The local task completed.",
      category: "transactional",
    });

    expect(delivery).toMatchObject({
      workspaceId: "workspace-a",
      status: "queued",
    });
    await expect(
      sender.getStatus({
        workspaceId: "workspace-a",
        deliveryId: delivery.id,
      }),
    ).resolves.toEqual(delivery);
  });

  test("does not reveal an outbox delivery to another workspace", async () => {
    const sender = createEmailSender();
    const delivery = await sender.send({
      workspaceId: "workspace-a",
      to: "owner@example.com",
      subject: "Your task is complete",
      text: "The local task completed.",
      category: "transactional",
    });

    await expect(
      sender.getStatus({
        workspaceId: "workspace-b",
        deliveryId: delivery.id,
      }),
    ).resolves.toBeUndefined();
  });

  test("rejects outreach messages at the transactional boundary", async () => {
    const sender = createEmailSender();
    expect(emailApi).toHaveProperty("OutreachEmailRejectedError");

    await expect(
      sender.send({
        workspaceId: "workspace-a",
        to: "prospect@example.com",
        subject: "Quick question",
        text: "Can we talk?",
        category: "outreach",
      }),
    ).rejects.toBeInstanceOf(emailApi!.OutreachEmailRejectedError!);
  });

  test("lists deliveries newest-first and can filter by workspace", async () => {
    const sender = createEmailSender();
    await sender.send({
      workspaceId: "workspace-a",
      to: "a@example.com",
      subject: "First",
      text: "one",
      category: "transactional",
    });
    await sender.send({
      workspaceId: "workspace-b",
      to: "b@example.com",
      subject: "Second",
      text: "two",
      category: "transactional",
    });

    expect(sender.listDeliveries().map((entry) => entry.subject)).toEqual(["Second", "First"]);
    expect(sender.listDeliveries("workspace-a")).toHaveLength(1);
  });

  test("bounds, expires, and truncates retained preview deliveries", async () => {
    let now = 1_000;
    const sender = new emailApi!.LocalOutboxEmailSender!({
      maxEntries: 2,
      now: () => now,
      ttlMs: 50,
    });
    const first = await sender.send({
      workspaceId: "workspace-a",
      to: "a@example.com",
      subject: "First",
      text: "x".repeat(9_000),
      category: "transactional",
    });
    expect(sender.listDeliveries()[0]!.text).toHaveLength(8_192);
    await sender.send({
      workspaceId: "workspace-a",
      to: "b@example.com",
      subject: "Second",
      text: "two",
      category: "transactional",
    });
    expect(sender.listDeliveries()).toHaveLength(2);
    expect(sender.listDeliveries().find((delivery) => delivery.id === first.id)?.text).toHaveLength(
      8_192,
    );
    await sender.send({
      workspaceId: "workspace-a",
      to: "c@example.com",
      subject: "Third",
      text: "three",
      category: "transactional",
    });

    expect(sender.listDeliveries()).toHaveLength(2);
    expect(sender.listDeliveries()[1]!.id).not.toBe(first.id);
    expect(sender.listDeliveries()[0]!.text).toBe("three");
    // The API return stays complete, but retained local preview content is capped.
    expect(first.text).toHaveLength(9_000);
    const retainedFirst = sender.listDeliveries().find((delivery) => delivery.id === first.id);
    expect(retainedFirst).toBeUndefined();

    now += 51;
    expect(sender.listDeliveries()).toEqual([]);
  });
});

describe("EmailDeliveryStatusStore", () => {
  test("keeps only scoped status metadata and applies TTL and count bounds", () => {
    let now = 10;
    const store = new emailApi!.EmailDeliveryStatusStore!({
      maxEntries: 1,
      now: () => now,
      ttlMs: 5,
    });
    store.record({
      id: "email_1",
      workspaceId: "workspace-a",
      to: "person@example.com",
      subject: "OTP 123456",
      text: "https://secret.example/magic?token=hidden",
      status: "queued",
    });

    expect(store.get({ deliveryId: "email_1", workspaceId: "workspace-a" })).toEqual({
      id: "email_1",
      workspaceId: "workspace-a",
      status: "queued",
    });
    expect(store.get({ deliveryId: "email_1", workspaceId: "workspace-b" })).toBeUndefined();
    store.record({
      id: "email_2",
      workspaceId: "workspace-a",
      to: "person@example.com",
      subject: "Second",
      text: "second",
      status: "queued",
    });
    expect(store.get({ deliveryId: "email_1", workspaceId: "workspace-a" })).toBeUndefined();

    store.record({
      id: "x".repeat(257),
      workspaceId: "workspace-a",
      to: "person@example.com",
      subject: "Oversized metadata",
      text: "ignored",
      status: "queued",
    });
    expect(store.get({ deliveryId: "x".repeat(257), workspaceId: "workspace-a" })).toBeUndefined();

    now += 6;
    expect(store.get({ deliveryId: "email_2", workspaceId: "workspace-a" })).toBeUndefined();
  });
});

describe("getSharedLocalOutboxEmailSender", () => {
  test("returns one process-wide local outbox instance", () => {
    expect(emailApi).toHaveProperty("getSharedLocalOutboxEmailSender");
    const first = emailApi!.getSharedLocalOutboxEmailSender!();
    const second = emailApi!.getSharedLocalOutboxEmailSender!();
    expect(first).toBe(second);
  });

  test("retains queued mail across module reloads", async () => {
    const sender = emailApi!.getSharedLocalOutboxEmailSender!();
    const delivery = await sender.send({
      category: "transactional",
      subject: "Verification code",
      text: "Example verification message",
      to: "person@example.test",
      workspaceId: "pre-auth",
    });

    vi.resetModules();
    const reloaded = await import("./index");
    const preview = reloaded.getSharedLocalOutboxEmailSender();

    expect(preview.listDeliveries("pre-auth")).toContainEqual(delivery);
    expect(preview.listDeliveries("another-workspace")).toEqual([]);
    expect(preview).toBe(sender);
  });
});

describe("ResendTransactionalEmailSender", () => {
  test("maps one transactional delivery to Resend and preserves workspace lookup", async () => {
    const requests: unknown[] = [];
    const sender = createResendSender({
      emails: {
        async send(input) {
          requests.push(input);
          return { data: { id: "resend_123" }, error: null };
        },
      },
    });

    const delivery = await sender.send({
      workspaceId: "workspace-a",
      to: "owner@example.com",
      subject: "Your task is complete",
      text: "The task completed.",
      category: "transactional",
    });

    expect(delivery).toEqual({
      id: "resend_123",
      workspaceId: "workspace-a",
      to: "owner@example.com",
      subject: "Your task is complete",
      text: "The task completed.",
      status: "queued",
    });
    expect(requests).toEqual([
      {
        from: "supastack <noreply@example.com>",
        to: ["owner@example.com"],
        subject: "Your task is complete",
        text: "The task completed.",
      },
    ]);
    await expect(
      sender.getStatus({ workspaceId: "workspace-b", deliveryId: delivery.id }),
    ).resolves.toBeUndefined();
    await expect(
      sender.getStatus({ workspaceId: "workspace-a", deliveryId: delivery.id }),
    ).resolves.toEqual({ id: "resend_123", workspaceId: "workspace-a", status: "queued" });
  });

  test("rejects outreach before calling Resend", async () => {
    let sendCalls = 0;
    const sender = createResendSender({
      emails: {
        async send() {
          sendCalls += 1;
          return { data: { id: "unused" }, error: null };
        },
      },
    });

    await expect(
      sender.send({
        workspaceId: "workspace-a",
        to: "prospect@example.com",
        subject: "Quick question",
        text: "Can we talk?",
        category: "outreach",
      }),
    ).rejects.toBeInstanceOf(emailApi!.OutreachEmailRejectedError!);
    expect(sendCalls).toBe(0);
  });
});

describe("SesTransactionalEmailSender", () => {
  test("maps a transactional delivery to an injected SES command client", async () => {
    const requests: unknown[] = [];
    const commands: unknown[] = [];
    const sender = createSesSender({
      createSendEmailCommand(input) {
        requests.push(input);
        return { type: "SendEmailCommand", input };
      },
      async send(command) {
        commands.push(command);
        return { MessageId: "ses_123" };
      },
    });

    await expect(
      sender.send({
        workspaceId: "workspace-a",
        to: "owner@example.com",
        subject: "Your task is complete",
        text: "The task completed.",
        category: "transactional",
      }),
    ).resolves.toMatchObject({ id: "ses_123", workspaceId: "workspace-a", status: "queued" });

    expect(requests).toEqual([
      {
        FromEmailAddress: "noreply@example.com",
        Destination: { ToAddresses: ["owner@example.com"] },
        Content: {
          Simple: {
            Subject: { Data: "Your task is complete", Charset: "UTF-8" },
            Body: { Text: { Data: "The task completed.", Charset: "UTF-8" } },
          },
        },
      },
    ]);
    expect(commands).toEqual([{ type: "SendEmailCommand", input: requests[0] }]);
  });
});

describe("HtmlTemplatedEmailSender", () => {
  test("renders the branded shell when the message carries no html", async () => {
    const inner = createEmailSender();
    const sender = new emailApi!.HtmlTemplatedEmailSender!(inner);

    const delivery = await sender.send({
      workspaceId: "workspace-a",
      to: "owner@example.com",
      subject: "Your task is complete",
      text: "The task completed.",
      category: "transactional",
    });

    expect(delivery.html).toMatch(/<!doctype html/i);
    expect(delivery.html).toMatch(/<html[^>]*lang="en"/);
    expect(delivery.html).toContain("The task completed.");
    expect(delivery.html).toContain("Do not reply.");
  });

  test("forwards lang and footer into the rendered shell", async () => {
    const inner = createEmailSender();
    const sender = new emailApi!.HtmlTemplatedEmailSender!(inner);

    const delivery = await sender.send({
      workspaceId: "workspace-a",
      to: "owner@example.com",
      subject: "Einladung",
      text: "Sie wurden eingeladen.",
      lang: "de",
      footer: "Dies ist eine Transaktionsnachricht von supastack. Bitte nicht antworten.",
      category: "transactional",
    });

    expect(delivery.html).toMatch(/<html[^>]*lang="de"/);
    expect(delivery.html).toContain("Bitte nicht antworten.");
    expect(delivery.html).not.toContain("Do not reply.");
  });

  test("keeps a provided html body untouched", async () => {
    const inner = createEmailSender();
    const sender = new emailApi!.HtmlTemplatedEmailSender!(inner);

    const delivery = await sender.send({
      workspaceId: "workspace-a",
      to: "owner@example.com",
      subject: "S",
      text: "t",
      html: "<b>custom</b>",
      category: "transactional",
    });

    expect(delivery.html).toBe("<b>custom</b>");
  });
});
