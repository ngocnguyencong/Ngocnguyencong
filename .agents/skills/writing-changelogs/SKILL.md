---
name: writing-changelogs
description: Use when writing or editing public changelog entries, release notes, "what's new" lists, or shipped-work bullets — especially when drafts read like commit messages with implementation mechanics, root causes, internal identifiers, or multi-clause caveats.
---

# Writing changelogs

## Overview

A public changelog is evidence the product is alive — a buyer scans it in ten seconds to judge momentum, not to learn internals. Write the outcome a reader gets, never the mechanism you changed. If a bullet needs the diff to make sense, it fails.

## The bar for a bullet

- One shipped capability per bullet. If it needs an em-dash chain of caveats, it's a doc note — cut the detail or move it to docs.
- Feature-led: state what exists now ("FAQ answers animate when expanded"), not the history of what was broken.
- `Fixed:` prefix for bug fixes — name the visible symptom and the result, never the root cause.
- Concrete nouns beat qualifiers ("Nine billing providers", "a self-hosting guide"). Cut "now correctly", "previously", and re-explanations of the old bug.
- Never explain the fix. No mechanism, no root cause, no "previously it failed because…" — a bullet that justifies itself reads like a vulnerability disclosure. State the shipped outcome and stop.
- Public API surface may be named — env vars, CLI commands, routes, config flags, exported props buyers actually type (`BILLING_PROVIDER` is fine). Internal machinery may not — file paths, CSS selectors/pseudo-elements, function names, specificity tricks, schema internals, test names, commit hashes.
- Length: one short sentence. An em-dash or "because/since/which meant" tail that explains _how_ or _why_ is the tell — delete the tail, keep the claim.

## Rewrite tests — run before keeping a bullet

1. **Reader test** — can someone who never saw the code say what they now get?
2. **Deletion test** — delete the mechanism clause ("via …", "because …", "the previous …"). Bullet still true and still worth publishing? The clause stays deleted.
3. **Docs-vs-changelog test** — does the detail teach configuration, deployment, or debugging? Move it to the guide; the bullet only announces the guide exists.

## Real rewrites

| Commit-message draft                                                                                                                                                                                                         | Changelog bullet                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| FAQ answers now animate via ::details-content — the previous transition on the inner wrapper could never fire because a closed disclosure doesn't render its children                                                        | Fixed: FAQ answers now animate open and closed.                                                          |
| self-hosting guide — ~4 GB RAM on-box (~2 GB floor with swap + `NODE_OPTIONS` heap cap) or CI-built image on ~1–2 GB VPS, Dockerfile pack on :8080, runtime-only env, external migrations, domain + TLS, scheduler-tick cron | New self-hosting guide: deploy to a cheap VPS with Coolify — build on-box or ship a CI-built image.      |
| marketing margin reset tied module auto margins at equal specificity so stylesheet order decided alignment; reset now in `:where()` at zero specificity                                                                      | Fixed: utility pages (showcase, contact, legal) could lose their horizontal centering.                   |
| structured completions unwrap a single-key envelope matching the schema name — models answering `{"<name>":{…}}` validate instead of exhausting the repair loop                                                              | Fixed: structured AI completions now accept schema-named single-key responses from third-party gateways. |

## Process

- Dates are real ship days. Never forward-date because the date is taken — fold same-day work into the existing entry.
- Order: headline features first, `Fixed:` bullets next, polish last.
- Check the repo's agent rules for where entries live and which localized copies/tests each entry needs; completeness tests may enforce per-locale point parity.
- After drafting, re-read every bullet and delete each clause a buyer cannot act on.
