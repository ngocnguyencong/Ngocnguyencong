# apps/web/next.config.ts

Next standalone build configuration. Keeps file tracing rooted at the workspace and transpiles the source exports of the shared packages consumed by Web.

`@supastack/agents` belongs in `transpilePackages` alongside the other shared packages. Its adapters stay lazily selected; extensionless relative imports resolve the actual TypeScript source exports.
