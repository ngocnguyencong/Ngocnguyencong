
## 2026-10-13 account-state stability
Enhanced navbar actions wait for a confirmed session. A single browser client and document-scoped confirmed snapshot survive header remounts and pending/error refetches. Confirmed sign-out and account changes immediately replace the displayed identity. No persistent user data or server-wide session cache is added. No-JS actions remain real navigation/forms in noscript, including desktop.
The generic demo header uses its existing Get started action for guests and localized Return to dashboard for authenticated users. No purchase/license machinery is included. Session and header regressions pass with the existing public-page suite. Existing typography, menu focus, motion and locale dictionaries are preserved.
