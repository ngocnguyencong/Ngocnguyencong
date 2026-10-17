# vitest.config.ts

## Purpose

Run deterministic workspace and root unit tests, excluding generated output.

## Windows worker policy

Windows workers are capped at four, retaining Vitest's defaults elsewhere. A full
local gate ran 1,695 tests successfully but failed starting the jsdom OTP worker
under the machine's default parallelism. Preserve the actual OTP interaction
tests and all existing timeout/assertion settings.
