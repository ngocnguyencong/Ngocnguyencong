# platform-actions.ts

## Purpose

Platform-only flag and announcement reads and mutations. Each exported action
requires the verified, non-banned administrator session before database access;
the admin page layout alone is not the callable operation's authorization guard.
Public app announcements use the separate authenticated active-window reader.
