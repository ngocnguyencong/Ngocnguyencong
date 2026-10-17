import { defineConfig } from "@trigger.dev/sdk";

const project = process.env.TRIGGER_PROJECT_REF?.trim();
if (!project) {
  throw new Error("TRIGGER_PROJECT_REF is required to deploy Trigger.dev tasks.");
}

export default defineConfig({
  dirs: ["./trigger"],
  maxDuration: 300,
  project,
  retries: {
    default: {
      factor: 2,
      maxAttempts: 1,
      maxTimeoutInMs: 30_000,
      minTimeoutInMs: 1_000,
      randomize: true,
    },
    enabledInDev: false,
  },
});
