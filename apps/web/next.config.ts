import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(appDir, "../.."),
  transpilePackages: [
    "@supastack/agents",
    "@supastack/ai",
    "@supastack/auth",
    "@supastack/api",
    "@supastack/billing",
    "@supastack/config",
    "@supastack/db",
    "@supastack/design-tokens",
    "@supastack/email",
    "@supastack/i18n",
    "@supastack/jobs",
    "@supastack/storage",
    "@supastack/ui-web",
  ],
};

export default nextConfig;
