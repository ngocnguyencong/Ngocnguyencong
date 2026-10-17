import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./tests/smoke/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/smoke/**/*.smoke.ts"],
    passWithNoTests: false,
    testTimeout: 60_000,
  },
});
