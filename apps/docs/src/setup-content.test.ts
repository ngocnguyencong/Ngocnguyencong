import { expect, test } from "vitest";

const loadSetupContent = () => import("./setup-content");

test("separates the credential-free fake/local quickstart from real-provider prerequisites", async () => {
  const { setupGuidance } = await loadSetupContent();

  expect(setupGuidance.local.title).toBe("Local fake-adapter quickstart");
  expect(setupGuidance.local.requiresCredentials).toBe(false);
  const instructions = setupGuidance.local.steps.join("\n");
  expect(instructions).toContain("apps/web/.env.local");
  expect(instructions).toContain("corepack pnpm install");
  expect(instructions).toContain("corepack pnpm --filter @supastack/web dev");
  expect(instructions).toContain("http://localhost:3000/ai");
  expect(setupGuidance.providers.requiresCredentials).toBe(true);
  expect(setupGuidance.providers.command).toBe("pnpm smoke:providers");
  expect(setupGuidance.providers.prerequisites).toEqual(
    expect.arrayContaining([
      "A Stripe sandbox account and webhook signing secret.",
      "At least one supported AI provider API key.",
      "A Resend or SES transactional-email account and verified sending domain.",
      "OAuth app credentials for any real Google or Apple sign-in smoke test.",
    ]),
  );
});

test("points agents at the autonomous setup runbook", async () => {
  const { setupGuidance } = await loadSetupContent();

  expect(setupGuidance.agent.title).toBe("AI agent setup path");
  expect(setupGuidance.agent.requiresCredentials).toBe(false);
  expect(setupGuidance.agent.runbook).toBe("docs/agent-setup.md");
  const instructions = setupGuidance.agent.steps.join("\n");
  expect(instructions).toContain("llms.txt");
  expect(instructions).toContain("AGENTS.md");
  expect(instructions).toContain("docs/agent-setup.md");
  expect(instructions).toContain(".env.example");
  expect(instructions).toContain("docker-compose.dev.yml");
  expect(instructions).toContain("docs/vps-coolify.md");
  expect(instructions).toContain("jobs:tick");
  expect(instructions).toContain("/api/health");
});
