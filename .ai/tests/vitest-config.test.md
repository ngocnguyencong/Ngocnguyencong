# tests/vitest-config.test.ts

## Purpose

Guard the Windows worker limit that keeps cold jsdom worker startup reliable,
without changing parallelism on Linux or macOS.
