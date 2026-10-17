import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.expo/**",
      "**/.next/**",
      "**/.next*/**",
      "**/.turbo/**",
      ".worktrees/**",
      "**/coverage/**",
      "**/dist/**",
      ".subrepos/**",
      "**/tmp/**",
      "**/src-tauri/target/**",
      "**/src-tauri/gen/**",
      "node_modules/**",
      "**/next-env.d.ts",
      "pnpm-lock.yaml",
      "**/src-tauri/gen/**",
      "**/src-tauri/target/**",
      "**/test-results/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    ...tseslint.configs.disableTypeChecked,
    files: ["**/*.{cjs,js,mjs}"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ["**/*.config.{js,mjs,ts}", "**/*.test.ts", "tests/**/*.ts"],
  },
);
