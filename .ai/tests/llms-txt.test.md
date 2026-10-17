# tests/llms-txt.test.ts

> Last updated: 2026-10-07 | Protection: STANDARD

## Purpose

Guard `llms.txt` (llmstxt.org agent entry map) against rot: file shape,
relative-link resolution, security-section keywords, required core links,
and the trailing Optional section.

## Important Notes / NEVER Change

- Assertions: (1) file exists, opens with `# ` H1, `>` blockquote within the
  first 10 lines; (2) every `[label](target)` with a relative target resolves
  to an existing file/dir — offenders are listed in the failure message;
  (3) the `## Security protocols` section links `docs/agent-security.md` and
  mentions `workspaceId`, `openssl` or `AUTH_SECRET`, `NEXT_PUBLIC_` or
  `EXPO_PUBLIC_`, Better Auth, PostgREST, `redactSensitive`, RLS, and rate
  limit;
  (4) required link substrings — `AGENTS.md`, `.env.example`,
  `docs/agent-setup.md`, `docs/deployment.md`, `docs/vps-coolify.md`,
  `Dockerfile`, `docker-compose.yml`, `prompts/`, `packages/db`;
  (5) the preamble before the first `## ` contains no headings (guidance
  zone per the spec); (6) the LAST `##` section is `Optional`; (7) every
  `- [label](target)` bullet carries a `: note` annotation.
- Link parsing is intentionally narrow — inline `[label](target)` only;
  reference-style links, images, and code spans are not extracted (llms.txt
  is a controlled file). It strips `#anchor`/`?query` and skips external
  schemes (`http(s)`, `mailto:`, `tel:`, `ftp:`, protocol-relative);
  absolute local paths are flagged as offenders.
- Pure node `fs`/`path`, no app imports — matches the other root guards in
  `tests/` and runs under the default vitest config.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-07 | Security checks pin the shared checklist and explicit auth, PostgREST and redacted logging references | Codex |
| 2026-10-06 | Created alongside `llms.txt`; preamble-headingless assertion added at integration | Devin |
| 2026-10-06 | Quality-review hardening: `Optional` must be the LAST `##` section; every link bullet needs a `: note`; documented intentional regex narrowness | Devin |
