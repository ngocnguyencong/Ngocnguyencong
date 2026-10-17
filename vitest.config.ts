import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  test: {
    maxWorkers: process.platform === "win32" ? 4 : undefined,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.worktrees/**"],
    include: ["packages/**/*.test.{ts,tsx}", "apps/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
