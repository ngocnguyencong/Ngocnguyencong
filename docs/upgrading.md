# Upgrade between supastack revisions

Treat an upgrade as a small integration project. Record the source revision you
currently use, compare it with the target revision, review migrations and
configuration changes, then test in a branch before deploying. This works for
both a fork of a synced platform repository and code selectively adapted into
another app.

## Record the baseline

Keep a note in your product repository with the supastack commit SHA you
started from, the repository you forked (`supastack-web`, `supastack-mobile`,
or `supastack-desktop`), and any local adaptations. Those repositories and
the monorepo have different histories: never merge a branch from one into a
fork of another.

If you did not record a starting SHA, find the closest common ancestor with
`git merge-base` for a fork, or identify the last copied files and tests for
a selective adoption. Review a wider diff when the exact baseline is uncertain.

## Upgrade a fork with shared history

Run this from a clean working tree in your product fork, replacing the remote
URL with the matching source repository. Do not overwrite product changes.

```bash
# Upstream is the platform repository you forked — substitute its real URL
# (supastack-web shown; use supastack-mobile or supastack-desktop as fits).
git remote add kit-upstream https://github.com/<org>/supastack-web.git
git fetch kit-upstream
git switch -c upgrade/kit-update
git log --oneline <previous-kit-sha>..kit-upstream/main
git diff --stat <previous-kit-sha>..kit-upstream/main
git merge kit-upstream/main
```

If the `kit-upstream` remote already exists, skip the `remote add` command.
Review the full diff for the modules you use, not only the commit titles.
Resolve conflicts in the upgrade branch and run the tests for each resolved
area. Avoid replacing a customized route or configuration file wholesale.

## Upgrade selectively adapted modules

Without shared Git history, compare the old source SHA with the target source
SHA and port the changes that affect your adopted slice. Review its public
types, persistence schema and migrations, server caller, configuration, tests,
and docs as one unit. Changes in a package may require a route or environment
change elsewhere in the repository.

For example, an entitlement update may touch the billing event normalizer,
database rows, content access projection, and mobile response shape. Copying
only the entitlement helper could leave a client using an outdated contract.
Keep a short adaptation note so the next upgrade can replay your choices.

## Check data and deployment order

1. Read new files in `packages/db/drizzle/` and back up production data before
   applying migrations. Test migrations against a disposable copy first.
2. Compare `.env.example` and the relevant configuration docs. Add newly
   required values in your deployment system; keep secrets out of Git and
   client bundles.
3. Deploy compatible schema changes before code that requires them. If a
   migration removes or transforms data, plan a separate data rollback;
   rolling back app code alone may not restore the old schema.
4. Run targeted tests, typecheck, `pnpm check` (`pnpm verify:local` where
   the fuller monorepo gate exists), and a staging smoke pass. Verify
   sign-in, tenant isolation, entitlements, jobs, and your product's main
   user journey.
5. Record the accepted target SHA and any conflict resolutions. Revisit your
   pinned source before the next upgrade.

Release notes help you find changes, but the source diff and migration files
are the final record of what your particular revision needs.
