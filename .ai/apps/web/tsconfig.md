# apps/web/tsconfig.json

## Purpose

Select the Web app source and generated Next types for strict typechecking.

## Important Notes

Include `next-env.d.ts` and both production/dev route types. The app typecheck
generates these files before tsc, so a fresh checkout needs no prior dev or
build. Do not commit generated files.
