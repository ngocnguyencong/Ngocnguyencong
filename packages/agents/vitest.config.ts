import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: false,
    // Framework SDK cold imports (@mastra/core especially) can exceed the
    // default 5s under parallel monorepo runs.
    testTimeout: 30_000,
  },
});
