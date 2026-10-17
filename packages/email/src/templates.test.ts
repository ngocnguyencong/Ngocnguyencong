import { describe, expect, it } from "vitest";

import { renderTransactionalEmailHtml } from "./templates";

describe("renderTransactionalEmailHtml", () => {
  it("wraps text in a branded HTML shell with paragraph splitting", async () => {
    const html = await renderTransactionalEmailHtml({
      body: "Line one.\n\nLine two.",
      subject: "Hello",
    });
    expect(html).toMatch(/<!doctype html/i);
    expect(html).toContain("Line one.");
    expect(html).toContain("Line two.");
    expect(html).toContain("supastack");
    // The phone-first card keeps its 440px content width.
    expect(html).toContain("440px");
  });

  it("preserves single-line breaks inside a paragraph", async () => {
    const html = await renderTransactionalEmailHtml({
      body: "First line\nsecond line",
      subject: "Breaks",
    });
    expect(html).toContain("First line");
    expect(html).toContain("second line");
    expect(html).toContain("<br");
  });

  it("escapes HTML in user-controlled content", async () => {
    const html = await renderTransactionalEmailHtml({
      body: "<script>alert(1)</script> & <b>",
      subject: "Hi <there>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("renders an optional CTA button", async () => {
    const html = await renderTransactionalEmailHtml({
      body: "Click below.",
      cta: { href: "https://example.com/accept", label: "Accept invite" },
      subject: "Invite",
    });
    expect(html).toContain('href="https://example.com/accept"');
    expect(html).toContain("Accept invite");
    expect(html).toContain('role="button"');
  });

  it("defaults to lang=en, the supastack wordmark, and the English footer", async () => {
    const html = await renderTransactionalEmailHtml({ body: "Hi.", subject: "S" });
    expect(html).toMatch(/<html[^>]*lang="en"/);
    expect(html).toContain("supastack");
    expect(html).toContain("This is a transactional message from supastack. Do not reply.");
  });

  it("renders the caller's lang and localized footer", async () => {
    const html = await renderTransactionalEmailHtml({
      body: "Sie wurden eingeladen.",
      footer: "Dies ist eine Transaktionsnachricht von supastack. Bitte nicht antworten.",
      lang: "de",
      subject: "Einladung",
    });
    expect(html).toMatch(/<html[^>]*lang="de"/);
    expect(html).toContain("Bitte nicht antworten.");
    expect(html).not.toContain("Do not reply.");
  });

  it("honors brandName in the mark and the default footer", async () => {
    const html = await renderTransactionalEmailHtml({
      body: "Hi.",
      brandName: "acme app",
      subject: "S",
    });
    expect(html).toContain("acme app");
    expect(html).toContain("from acme app");
    expect(html).not.toContain("supastack");
  });

  it("escapes a hostile footer and lang", async () => {
    const html = await renderTransactionalEmailHtml({
      body: "Hi.",
      footer: "<img src=x onerror=alert(1)>",
      lang: 'en"><script>',
      subject: "S",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('lang="en"><script>');
    expect(html).toContain("&lt;img");
  });

  it("renders text-only chrome without embedded logo artwork", async () => {
    const html = await renderTransactionalEmailHtml({ body: "Hi.", subject: "S" });
    expect(html).toContain('role="presentation"');
    expect(html).toContain("supastack");
    expect(html).not.toMatch(/<svg|<img|bgcolor=|border:1px solid #686868/);
  });

  it("keeps a readable application name above the message", async () => {
    const html = await renderTransactionalEmailHtml({ body: "Hi.", subject: "S" });
    // td padding-bottom, not table margin — Word engines drop the latter.
    expect(html.match(/padding-bottom:26px/g)).toHaveLength(1);
    expect(html).toContain("font-size:15px");
    expect(html).toContain("font-weight:500");
    expect(html).toContain("color:#ededed");
  });
});
