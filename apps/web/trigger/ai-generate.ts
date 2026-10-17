import { task } from "@trigger.dev/sdk";

import { executeTriggeredAiTask } from "../src/ai-task-runtime";

export const aiGenerateTask = task({
  id: "ai.generate",
  retry: {
    factor: 2,
    // Completed re-entry recovers only notification delivery; AI is atomically claimed once.
    maxAttempts: 3,
    maxTimeoutInMs: 30_000,
    minTimeoutInMs: 1_000,
    randomize: true,
  },
  run: async (payload: unknown) => executeTriggeredAiTask(payload),
});
