import { describe, expect, it } from "vitest";
import { selectWarmPaths } from "./e2e/global-setup";

describe("browser route warm-up selection", () => {
  it("bounds a multilingual documentation sitemap by its shared page modules", () => {
    const paths = ["", "de/", "es/", "fr/"].flatMap((locale) =>
      Array.from({ length: 162 }, (_, guide) => `/${locale}docs/web/guide-${guide}`),
    );
    expect(selectWarmPaths(paths)).toEqual([
      "/docs/web/guide-0",
      "/de/docs/web/guide-0",
      "/es/docs/web/guide-0",
      "/fr/docs/web/guide-0",
    ]);
  });

  it("skips explicitly warmed paths and documentation families", () => {
    expect(
      selectWarmPaths(
        ["/", "/docs/web/first-run", "/docs/modules/ai", "/de/docs/web/first-run", "/privacy"],
        ["/", "/docs", "/de/docs", "/privacy"],
      ),
    ).toEqual([]);
  });

  it("preserves distinct static and unrecognized public routes in order", () => {
    const paths = [
      "/legal/license",
      "/legal/disclaimer",
      "/settings",
      "/settings/appearance",
      "/blog/first-article",
      "/blog/second-article",
      "/new-public-route",
    ];
    expect(selectWarmPaths([...paths, "/legal/license"])).toEqual(paths);
  });
});
