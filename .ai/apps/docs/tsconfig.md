# apps/docs/tsconfig.json

## Purpose

Select documentation source, Next environment types and both build/dev generated
route types for strict typechecking.

## Important Notes

The app's typecheck runs `next typegen` first. Generated files stay ignored; both
route-type directories are included so dev/build do not mutate the config.
