# tests/setup-env.test.ts

> Last updated: 2026-10-07 | Protection: STANDARD

## Purpose

Test env bootstrap using disposable fixture directories, never operator files.
Twelve tests cover fresh setup, idempotence, reuse, CRLF/inline comments,
conflict/invalid/duplicate-key rejection, no-write checks, file-kind and
symlink-parent rejection, and CLI output that omits secret values.

## Verification

- Ran failing tests before implementation and each later preservation/path
  repair. Final focused helper run passes all twelve cases.
- Fixtures use the actual Node env parser and a directory junction on Windows
  (a symlink on other platforms); no developer-mode file symlink is required.
- The successful CLI check also asserts that both env files stay byte-for-byte
  unchanged. Fixtures are temporary and never use operator credentials.
