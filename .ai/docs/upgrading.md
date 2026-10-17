# docs/upgrading.md

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Guide buyers through controlled upgrades from newer kit revisions.

## Important Notes

- The worked `git remote add` example uses a `<org>/supastack-web.git`
  placeholder — buyers fork a platform repository, so the URL must be the
  one they actually forked, never a hardcoded upstream path.
- The acceptance gate names `pnpm check` (kept in every shipped manifest)
  and `pnpm verify:local` (the fuller gate that exists only in the
  monorepo).

## Open Threads / Resume Context

- Complete. The guide covers forks with shared history, selective adoption, migration and deployment order, and acceptance checks. It uses source SHAs because release tags are not assumed.

## Change History

| Date       | Change                                                                                         | Author |
| ---------- | ---------------------------------------------------------------------------------------------- | ------ |
| 2026-10-06 | Replaced the hardcoded upstream URL with a fork-placeholder + note; gate step names `pnpm check` | Devin  |
