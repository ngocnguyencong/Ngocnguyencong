/**
 * React Email transactional template. Plain text remains the canonical body;
 * this renders a neutral HTML companion so providers send a multipart message.
 * All user-controlled content flows through React children/attributes, so it
 * is escaped by the renderer.
 */

import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import { Fragment, type ReactNode } from "react";

export type TransactionalEmailHtmlInput = Readonly<{
  body: string;
  /** Text-only application name; defaults to "supastack". */
  brandName?: string | undefined;
  cta?: Readonly<{ href: string; label: string }> | undefined;
  /** Localized footer line; defaults to the English transactional notice. */
  footer?: string | undefined;
  /** BCP-47 tag for the `lang` attribute; defaults to "en". */
  lang?: string | undefined;
  subject: string;
}>;

const DEFAULT_BRAND_NAME = "supastack";

const defaultFooter = (brandName: string): string =>
  `This is a transactional message from ${brandName}. Do not reply.`;

function paragraphNodes(body: string): ReactNode[] {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph, index) => {
      const lines = paragraph.split("\n");
      return (
        <p key={index} style={{ margin: "0 0 14px" }}>
          {lines.map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 ? <br /> : null}
              {line}
            </Fragment>
          ))}
        </p>
      );
    });
}

function TransactionalEmail({
  body,
  brandName,
  cta,
  footer,
  subject,
}: Required<Pick<TransactionalEmailHtmlInput, "body" | "brandName" | "footer" | "subject">> &
  Pick<TransactionalEmailHtmlInput, "cta">) {
  return (
    <Body
      style={{
        background: "#0a0a0a",
        color: "#ededed",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        margin: "0",
        padding: "0",
      }}
    >
      {/* Phone-first: a ~440px card centered on the dark canvas, app name inside the
      card, localized footer below it. Tables/divs + inline styles only. */}
      <Container style={{ margin: "0 auto", maxWidth: "440px", padding: "32px 14px" }}>
        <Section
          style={{
            background: "#111111",
            border: "1px solid #262626",
            borderRadius: "18px",
            padding: "30px 26px",
          }}
        >
          <Row>
            <Column style={{ paddingBottom: "26px" }}>
              <span style={{ color: "#ededed", fontSize: "15px", fontWeight: 500 }}>
                {brandName}
              </span>
            </Column>
          </Row>
          <Heading as="h1" style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 20px" }}>
            {subject}
          </Heading>
          <Section style={{ color: "#d4d4d4", fontSize: "15px", lineHeight: "1.65" }}>
            {paragraphNodes(body)}
          </Section>
          {cta === undefined ? null : (
            <Text style={{ margin: "32px 0", textAlign: "center" }}>
              <Button
                href={cta.href}
                role="button"
                style={{
                  background: "#ffffff",
                  borderRadius: "8px",
                  color: "#000000",
                  display: "inline-block",
                  fontWeight: 600,
                  padding: "12px 24px",
                  textDecoration: "none",
                }}
              >
                {cta.label}
              </Button>
            </Text>
          )}
        </Section>
        <Text
          style={{
            color: "#737373",
            fontSize: "12px",
            lineHeight: "1.6",
            margin: "18px 8px 0",
          }}
        >
          {footer}
        </Text>
      </Container>
    </Body>
  );
}

export async function renderTransactionalEmailHtml(
  input: TransactionalEmailHtmlInput,
): Promise<string> {
  const brandName = input.brandName ?? DEFAULT_BRAND_NAME;
  const footer = input.footer ?? defaultFooter(brandName);
  const lang = input.lang ?? "en";

  return render(
    <Html lang={lang}>
      <Head>
        <title>{input.subject}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <TransactionalEmail
        body={input.body}
        brandName={brandName}
        footer={footer}
        subject={input.subject}
        {...(input.cta === undefined ? {} : { cta: input.cta })}
      />
    </Html>,
  );
}
