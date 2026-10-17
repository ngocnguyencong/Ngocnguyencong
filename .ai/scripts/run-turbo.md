# scripts/run-turbo.mjs

## Purpose

Launch the installed Turbo CLI through Node with a safe Windows cache default.

## Behavior

- Windows defaults to `TURBO_CACHE=local:r,remote:r`, preventing the reproduced
  writable-cache shutdown stall. Other platforms retain Turbo defaults.
- Preserve explicit `TURBO_CACHE` and CLI cache choices, arguments and child exit
  status. Use the installed dependency rather than a shell or global binary.
- Ship with any standalone root build that invokes this file.

## Open Threads / Resume Context

Platform/override/process tests passed. Windows acceptance completed with 18
uncached build tasks and a normal exit, followed by both browser suites. See the
Windows fresh-setup plan for the complete receipt and integration follow-up.
