import { rmSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

// Both suites run Next dev. Do not resume the first server's Turbopack graph.
const cache = fileURLToPath(new URL("../apps/web/.next", import.meta.url));
rmSync(cache, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
