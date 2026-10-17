# apps/web/src/notification-bell.interaction.test.tsx

## Purpose

Behavioral regression coverage for notification links rendered by the shared bell.

## Coverage

Mount the real notification component with internal, external, and hash-only destinations. Open its Popover and assert that internal paths use the active locale while other supported href forms stay byte-for-byte unchanged. The regression was verified red before the localePath implementation.
