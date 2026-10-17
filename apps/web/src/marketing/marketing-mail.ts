import "server-only";

import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { parseServerConfig } from "@supastack/config";
import { Resend } from "resend";

import type { MarketingSendInput } from "./marketing-leads";

export function createMarketingSend():
  ((message: MarketingSendInput) => Promise<void>) | undefined {
  const email = parseServerConfig().providers.email;
  if (email.kind === "resend") {
    const client = new Resend(email.apiKey);
    const from = email.from;
    return async (message) => {
      const result = await client.emails.send({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      });
      if (result.error !== null || result.data === null) {
        throw new Error("Marketing mail was not accepted.");
      }
    };
  }
  if (email.kind === "ses") {
    const client = new SESv2Client({
      ...(email.accessKeyId && email.secretAccessKey
        ? {
            credentials: {
              accessKeyId: email.accessKeyId,
              secretAccessKey: email.secretAccessKey,
              ...(email.sessionToken ? { sessionToken: email.sessionToken } : {}),
            },
          }
        : {}),
      region: email.region,
    });
    const from = email.from;
    return async (message) => {
      const result = await client.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [message.to] },
          Content: {
            Simple: {
              Subject: { Data: message.subject, Charset: "UTF-8" },
              Body: { Text: { Data: message.text, Charset: "UTF-8" } },
            },
          },
        }),
      );
      if (result.MessageId === undefined) {
        throw new Error("Marketing mail was not accepted.");
      }
    };
  }
  return undefined;
}
