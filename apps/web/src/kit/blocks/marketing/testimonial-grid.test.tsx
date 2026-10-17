import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { THEME_CATALOG } from "../../../theme/catalog";
import { STYLE_CATALOG } from "../../../theme/styles";
import { TestimonialGrid } from "./testimonial-grid";

const css = readFileSync(resolve(__dirname, "testimonial-grid.module.css"), "utf8");
const marketingThemeCss = readFileSync(resolve(__dirname, "../../../../app/theme.css"), "utf8");

describe("copyable testimonial section", () => {
  it("renders a named section with its heading, mixed-language quotes, and truthful ratings", () => {
    const html = renderToStaticMarkup(
      <TestimonialGrid
        id="customer-stories"
        eyebrow="Customer stories"
        heading="What builders say"
        intro="Feedback from people using the kit."
        ratingLabel="{rating} von 5 Sternen"
        items={[
          { name: "Alex", quote: "It helped me launch.", rating: 5 },
          { name: "Bo", quote: "已经上线。", lang: "zh-Hans", rating: 4 },
          { name: "Cam", quote: "Useful base.", rating: 2 },
          { name: "Dee", quote: "Clear docs.", rating: 5 },
        ]}
      />,
    );

    expect(html).toContain('id="customer-stories"');
    expect(html).toContain('aria-labelledby="customer-stories-heading"');
    expect(html).toContain('<h2 id="customer-stories-heading"');
    expect(html).toContain("What builders say");
    expect(html).toContain('lang="zh-Hans"');
    expect(html).toContain("2 von 5 Sternen");
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="4 von 5 Sternen"');
    expect((html.match(/data-star=/g) ?? []).length).toBe(20);
    expect((html.match(/data-star="filled"/g) ?? []).length).toBe(16);
  });

  it("announces ratings via role=img and clamps out-of-range values", () => {
    const html = renderToStaticMarkup(
      <TestimonialGrid
        items={[
          { name: "Eli", quote: "Shipped fast.", rating: 7 },
          { name: "Fin", quote: "Room to grow.", rating: -2 },
        ]}
      />,
    );

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="5 out of 5 stars"');
    expect(html).toContain('aria-label="0 out of 5 stars"');
    expect((html.match(/data-star=/g) ?? []).length).toBe(10);
    expect((html.match(/data-star="filled"/g) ?? []).length).toBe(5);
  });

  it("keeps the existing card-only use working", () => {
    const html = renderToStaticMarkup(
      <TestimonialGrid items={[{ name: "Alex", quote: "A useful starting point." }]} />,
    );
    expect(html).toContain("A useful starting point.");
    expect(html).not.toContain("<h2");
  });

  it("uses tokens available in every design style, with inherited marketing preset axes", () => {
    expect(css).toMatch(/var\(--raised\)/);
    expect(css).toMatch(/var\(--radius-surface/);
    expect(css).toMatch(/var\(--space-room/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);

    for (const style of STYLE_CATALOG) {
      const pack = THEME_CATALOG.find((theme) => theme.id === style.theme);
      expect(pack, `${style.id} has a pack`).toBeDefined();
      for (const token of [
        "--page",
        "--section",
        "--raised",
        "--text",
        "--muted",
        "--border",
        "--accent",
      ] as const) {
        expect(pack?.tokens[token], `${style.id} provides ${token}`).toBeTruthy();
      }
    }

    for (const axis of ["data-density", "data-radius", "data-font"]) {
      expect(marketingThemeCss, `${axis} applies to inherited marketing`).toContain(axis);
    }
    expect(marketingThemeCss).toContain('.marketing-theme[data-marketing-theme="inherit"]');
    for (const radius of ["sharp", "soft", "round"]) {
      expect(marketingThemeCss).toContain(`html[data-radius="${radius}"] .marketing-theme`);
    }
  });
});
