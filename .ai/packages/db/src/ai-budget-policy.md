# packages/db/src/ai-budget-policy.ts

## Purpose

Shared effective monthly AI budget rule for worker context and transactional
provider-attempt authorization.

## Security Fix (2026-09-27)

Platform-funded AI workspaces without an explicit monthly limit use a $5 monthly default. BYOK null limits stay unlimited; explicit limits, including zero, take precedence.
