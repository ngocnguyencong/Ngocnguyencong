import { describe, expect, it } from "vitest";
import localConfig from "../playwright.config";
import productionConfig from "../playwright.production.config";

describe("local Playwright config", () => {
  it("starts its own web server instead of reusing an unrelated app", () => {
    expect(localConfig.webServer).toMatchObject({ reuseExistingServer: false });
  });

  it.each([localConfig, productionConfig])(
    "uses the pinned browser without requiring system Chrome",
    (config) => {
      expect(config.projects?.[0]?.use?.channel).toBe(process.env.PLAYWRIGHT_BROWSER_CHANNEL);
      expect(config.webServer).toMatchObject({ reuseExistingServer: false });
      const expectBudget = config === localConfig && process.platform === "win32" ? 30_000 : 15_000;
      expect(config.expect?.timeout).toBe(expectBudget);
      expect(config.timeout).toBe(60_000);
      expect(config.globalSetup).toBeDefined();
    },
  );

  it("serializes Windows local runs and keeps production single-worker", () => {
    expect(localConfig.workers).toBe(process.platform === "win32" ? 1 : undefined);
    expect(productionConfig.workers).toBe(1);
  });
});
