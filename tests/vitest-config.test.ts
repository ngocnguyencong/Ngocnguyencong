import { expect, it } from "vitest";
import config from "../vitest.config";

it("bounds Windows unit-test workers without changing other platforms", () => {
  expect(config.test?.maxWorkers).toBe(process.platform === "win32" ? 4 : undefined);
});
