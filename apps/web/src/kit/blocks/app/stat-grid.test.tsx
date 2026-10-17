import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatGrid } from "./stat-grid";

describe("StatGrid deltas", () => {
  it("renders a positive-change chip with the good tone when goodWhen=up", () => {
    const html = renderToStaticMarkup(
      <StatGrid
        items={[{ delta: { change: 0.12, goodWhen: "up" }, label: "Visitors", value: "1.2k" }]}
      />,
    );
    expect(html).toContain("+12%");
    expect(html).toContain('data-tone="good"');
    expect(html).toContain("vs previous period");
  });

  it("renders a bad tone when the change moves the wrong way", () => {
    const html = renderToStaticMarkup(
      <StatGrid
        items={[{ delta: { change: 0.4, goodWhen: "down" }, label: "Bounce", value: "40%" }]}
      />,
    );
    expect(html).toContain("+40%");
    expect(html).toContain('data-tone="bad"');
  });

  it("shows the signed percent for declines", () => {
    const html = renderToStaticMarkup(
      <StatGrid
        items={[{ delta: { change: -0.05, goodWhen: "up" }, label: "Views", value: "900" }]}
      />,
    );
    expect(html).toContain("-5%");
  });

  it("renders a muted dash for null or negligible change", () => {
    const html = renderToStaticMarkup(
      <StatGrid
        items={[
          { delta: { change: null, goodWhen: "up" }, label: "A", value: "0" },
          { delta: { change: 0.002, goodWhen: "up" }, label: "B", value: "0" },
        ]}
      />,
    );
    expect(html.match(/data-tone="flat"/g)?.length).toBe(2);
    expect(html).toContain("—");
  });

  it("keeps items without delta unchanged", () => {
    const html = renderToStaticMarkup(
      <StatGrid items={[{ hint: "h", label: "Latency", value: "84ms" }]} />,
    );
    expect(html).toContain("84ms");
    expect(html).toContain(">h<");
    expect(html).not.toContain("data-tone");
  });
});
