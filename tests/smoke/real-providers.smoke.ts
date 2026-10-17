import { test } from "vitest";

import { parseRealProviderSmokeConfig } from "../../apps/web/src/real-provider-smoke-config.js";
import { runRealProviderSmoke } from "../../apps/web/src/real-provider-smoke.js";

test("connects one real AI, transactional email, and Stripe sandbox", async () => {
  const smoke = parseRealProviderSmokeConfig();
  await runRealProviderSmoke({ config: smoke });
});
